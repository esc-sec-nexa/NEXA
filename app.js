// app.js
// Página principal: sesión + publicaciones con Firestore.

import {
    auth, db,
    onAuthStateChanged, signOut,
    collection, addDoc, query, orderBy, limit, onSnapshot,
    doc, updateDoc, deleteDoc, arrayUnion, arrayRemove, serverTimestamp
} from "./firebase-config.js";
import { iniciarPerfil } from "./scripts/perfil.js";
import { iniciarAmigos, detenerAmigos } from "./scripts/amigos.js";
import { iniciarChat, detenerChat } from "./scripts/chat.js";
import { revisarTexto, mensajeDeBloqueo } from "./scripts/moderacion.js";

// 1. ELEMENTOS DE LA PÁGINA
const nombreUsuario = document.getElementById("nombre-usuario");
const botonSalir = document.getElementById("boton-salir");
const campoTexto = document.getElementById("texto-publicacion");
const botonPublicar = document.getElementById("boton-publicar");
const mensajePublicar = document.getElementById("mensaje-publicar");
const lista = document.getElementById("lista-publicaciones");

let usuarioActual = null;
let iniciado = false;      // evita iniciar los módulos dos veces
let dejarDeEscuchar = null; // función para cerrar la conexión en vivo

// 2. SESIÓN
onAuthStateChanged(auth, (usuario) => {
    if (!usuario) {
        if (dejarDeEscuchar) dejarDeEscuchar();
        detenerAmigos();
        detenerChat();
        window.location.replace("login.html");
        return;
    }
    usuarioActual = usuario;
    nombreUsuario.textContent = usuario.displayName || usuario.email;
    document.body.classList.remove("cargando");
    if (!dejarDeEscuchar) escucharPublicaciones();
    if (!iniciado) {
        iniciado = true;
        iniciarPerfil(usuario, nombreUsuario);
        iniciarChat(usuario);
        iniciarAmigos(usuario);
    }
});

botonSalir.addEventListener("click", async () => {
    if (dejarDeEscuchar) dejarDeEscuchar();
    detenerAmigos();
    detenerChat();
    await signOut(auth);
});

// 3. ESCUCHAR PUBLICACIONES EN VIVO
// onSnapshot se ejecuta cada vez que algo cambia en la base de datos,
// por eso las publicaciones nuevas aparecen sin recargar la página.
function escucharPublicaciones() {
    const consulta = query(
        collection(db, "publicaciones"),
        orderBy("creada", "desc"),
        limit(50)
    );

    dejarDeEscuchar = onSnapshot(
        consulta,
        (resultado) => mostrarPublicaciones(resultado.docs),
        (error) => {
            console.error(error);
            lista.replaceChildren(crearAviso(
                error.code === "permission-denied"
                    ? "No tienes permiso para ver las publicaciones. Revisa las reglas de Firestore."
                    : "No se pudieron cargar las publicaciones."
            ));
        }
    );
}

function crearAviso(texto) {
    const p = document.createElement("p");
    p.className = "vacio";
    p.textContent = texto;
    return p;
}

// 4. MOSTRAR PUBLICACIONES
function mostrarPublicaciones(documentos) {
    lista.replaceChildren();

    if (documentos.length === 0) {
        lista.append(crearAviso("Todavía no hay publicaciones. Escribe la primera."));
        return;
    }

    documentos.forEach((d) => lista.append(crearTarjeta(d.id, d.data())));
}

function formatearFecha(marca) {
    // Justo al publicar, la fecha del servidor aún no llega (es null)
    if (!marca) return "Publicando...";
    return marca.toDate().toLocaleString("es-MX", {
        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
    });
}

function crearTarjeta(id, datos) {
    const likes = datos.likes || [];
    const meGusta = likes.includes(usuarioActual.uid);

    const tarjeta = document.createElement("article");
    tarjeta.className = "publicacion";

    // Cabecera: autor y fecha
    const cabecera = document.createElement("div");
    cabecera.className = "pub-cabecera";
    const autor = document.createElement("strong");
    autor.textContent = datos.autorNombre;
    const fecha = document.createElement("span");
    fecha.className = "pub-fecha";
    fecha.textContent = formatearFecha(datos.creada);
    cabecera.append(autor, fecha);

    // Texto (textContent evita que alguien inyecte código HTML)
    const texto = document.createElement("p");
    texto.className = "pub-texto";
    texto.textContent = datos.texto;

    // Acciones
    const acciones = document.createElement("div");
    acciones.className = "pub-acciones";

    const botonLike = document.createElement("button");
    botonLike.type = "button";
    botonLike.className = "btn-like" + (meGusta ? " activo" : "");
    botonLike.setAttribute("aria-pressed", meGusta);
    botonLike.textContent = "♥ " + likes.length;
    botonLike.addEventListener("click", () => alternarLike(id, meGusta));
    acciones.append(botonLike);

    // Solo el autor ve el botón de eliminar
    if (datos.autorId === usuarioActual.uid) {
        const botonBorrar = document.createElement("button");
        botonBorrar.type = "button";
        botonBorrar.className = "btn-borrar";
        botonBorrar.textContent = "Eliminar";
        botonBorrar.addEventListener("click", () => eliminarPublicacion(id));
        acciones.append(botonBorrar);
    }

    tarjeta.append(cabecera, texto, acciones);
    return tarjeta;
}

// 5. PUBLICAR
botonPublicar.addEventListener("click", async () => {
    mensajePublicar.textContent = "";
    const texto = campoTexto.value.trim();

    // Validación: campo vacío
    if (texto === "") {
        mensajePublicar.textContent = "Escribe algo antes de publicar.";
        return;
    }

    // Filtro de seguridad
    const revision = revisarTexto(texto);
    if (!revision.ok) {
        mensajePublicar.textContent = mensajeDeBloqueo(revision.motivo);
        return;
    }

    botonPublicar.disabled = true;
    try {
        await addDoc(collection(db, "publicaciones"), {
            texto: texto,
            autorId: usuarioActual.uid,
            autorNombre: usuarioActual.displayName || usuarioActual.email,
            creada: serverTimestamp(),
            likes: []
        });
        campoTexto.value = "";
    } catch (error) {
        console.error(error);
        mensajePublicar.textContent = "No se pudo publicar. Intenta de nuevo.";
    } finally {
        botonPublicar.disabled = false;
    }
});

// 6. ME GUSTA
async function alternarLike(id, yaLeGusta) {
    try {
        await updateDoc(doc(db, "publicaciones", id), {
            likes: yaLeGusta ? arrayRemove(usuarioActual.uid) : arrayUnion(usuarioActual.uid)
        });
    } catch (error) {
        console.error(error);
    }
}

// 7. ELIMINAR (solo las propias)
async function eliminarPublicacion(id) {
    if (!confirm("¿Eliminar esta publicación?")) return;
    try {
        await deleteDoc(doc(db, "publicaciones", id));
    } catch (error) {
        console.error(error);
    }
}