// scripts/amigos.js
// Buscar estudiantes y manejar solicitudes de amistad.
// Cada solicitud es un documento en "solicitudes" con id "quienEnvia_quienRecibe".

import {
    db, collection, query, where, limit, onSnapshot, getDoc,
    doc, setDoc, updateDoc, deleteDoc, serverTimestamp
} from "../firebase-config.js";

const lista = document.getElementById("lista-estudiantes");
const buscador = document.getElementById("buscar-estudiante");

let yo = null;
let estudiantes = [];
let enviadas = [];
let recibidas = [];
let cancelaciones = [];
let miPerfil = null;
const oyentes = [];

// Otros módulos (el chat) se enteran cuando cambia la lista de amigos
export function alCambiarAmigos(funcion) { oyentes.push(funcion); }

function esAmigo(u) {
    return enviadas.some((s) => s.para === u.uid && s.estado === "aceptada") ||
           recibidas.some((s) => s.de === u.uid && s.estado === "aceptada");
}

// Regla de seguridad: solo cuentas verificadas, y los menores solo se contactan entre menores
function puedeAgregar(u) {
    return miPerfil !== null && miPerfil.verificado === true &&
           (u.menor !== true || miPerfil.menor === true);
}

export function iniciarAmigos(usuario) {
    yo = usuario;

    const alFallar = (error) => {
        console.error(error);
        lista.replaceChildren(aviso("No se pudo cargar. Revisa las reglas de Firestore."));
    };

    getDoc(doc(db, "usuarios", yo.uid)).then((c) => { miPerfil = c.exists() ? c.data() : null; dibujar(); })
        .catch(console.error);

    cancelaciones.push(
        onSnapshot(query(collection(db, "usuarios"), limit(50)), (c) => {
            estudiantes = c.docs.map((d) => ({ uid: d.id, ...d.data() }))
                                .filter((u) => u.uid !== yo.uid);
            dibujar();
        }, alFallar),

        onSnapshot(query(collection(db, "solicitudes"), where("de", "==", yo.uid)), (c) => {
            enviadas = c.docs.map((d) => ({ id: d.id, ...d.data() }));
            dibujar();
        }, alFallar),

        onSnapshot(query(collection(db, "solicitudes"), where("para", "==", yo.uid)), (c) => {
            recibidas = c.docs.map((d) => ({ id: d.id, ...d.data() }));
            dibujar();
        }, alFallar)
    );

    buscador.addEventListener("input", dibujar);
}

export function detenerAmigos() {
    cancelaciones.forEach((cancelar) => cancelar());
    cancelaciones = [];
}

function aviso(texto) {
    const p = document.createElement("p");
    p.className = "vacio";
    p.textContent = texto;
    return p;
}

function boton(texto, alClic, principal) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn-accion" + (principal ? " principal" : "");
    b.textContent = texto;
    b.addEventListener("click", async () => {
        b.disabled = true;
        try { await alClic(); } catch (error) { console.error(error); b.disabled = false; }
    });
    return b;
}

function dibujar() {
    oyentes.forEach((f) => f(estudiantes.filter(esAmigo)));
    const filtro = buscador.value.trim().toLowerCase();
    const visibles = estudiantes.filter((u) => (u.nombre || "").toLowerCase().includes(filtro));

    lista.replaceChildren();
    if (visibles.length === 0) {
        lista.append(aviso(filtro ? "No encontramos a nadie con ese nombre."
                                  : "Aún no hay otros estudiantes. Invita a un compañero a crear su cuenta."));
        return;
    }
    visibles.forEach((u) => lista.append(crearTarjeta(u)));
}

function crearTarjeta(u) {
    const enviada = enviadas.find((s) => s.para === u.uid);
    const recibida = recibidas.find((s) => s.de === u.uid);

    const tarjeta = document.createElement("article");
    tarjeta.className = "publicacion";

    const nombre = document.createElement("strong");
    nombre.textContent = u.nombre || "Estudiante";
    if (u.rol && u.rol !== "estudiante") {
        nombre.textContent += " · " + (u.rol === "maestro" ? "Maestro/a" : "Padre o madre") +
                              (u.verificado ? " ✓" : " (sin verificar)");
    }
    const descripcion = document.createElement("p");
    descripcion.className = "pub-texto";
    descripcion.textContent = u.descripcion || "Sin descripción todavía.";

    const acciones = document.createElement("div");
    acciones.className = "pub-acciones";

    if ((enviada && enviada.estado === "aceptada") || (recibida && recibida.estado === "aceptada")) {
        const solicitud = enviada || recibida;
        acciones.append(estado("Amigos"), boton("Quitar", () => deleteDoc(doc(db, "solicitudes", solicitud.id))));
    } else if (enviada) {
        acciones.append(estado("Solicitud enviada"), boton("Cancelar", () => deleteDoc(doc(db, "solicitudes", enviada.id))));
    } else if (recibida) {
        acciones.append(
            boton("Aceptar", () => updateDoc(doc(db, "solicitudes", recibida.id), { estado: "aceptada" }), true),
            boton("Rechazar", () => deleteDoc(doc(db, "solicitudes", recibida.id)))
        );
    } else if (!puedeAgregar(u)) {
        acciones.append(estado("Contacto no disponible por seguridad"));
    } else {
        acciones.append(boton("Agregar", () => setDoc(doc(db, "solicitudes", yo.uid + "_" + u.uid), {
            de: yo.uid,
            deNombre: yo.displayName || yo.email,
            para: u.uid,
            paraNombre: u.nombre || "Estudiante",
            estado: "pendiente",
            creada: serverTimestamp()
        }), true));
    }

    tarjeta.append(nombre, descripcion, acciones);
    return tarjeta;
}

function estado(texto) {
    const s = document.createElement("span");
    s.className = "pub-fecha";
    s.textContent = texto;
    return s;
}