// auth.js
// Lógica de la página login.html: iniciar sesión y crear cuenta.

import {
    auth,
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    updateProfile,
    db, doc, setDoc, serverTimestamp
} from "./firebase-config.js";

// 1. ENCONTRAR LOS ELEMENTOS DE LA PÁGINA
const pestanaEntrar = document.getElementById("pestana-entrar");
const pestanaRegistro = document.getElementById("pestana-registro");
const formEntrar = document.getElementById("form-entrar");
const formRegistro = document.getElementById("form-registro");
const mensaje = document.getElementById("mensaje");

// Mientras creamos la cuenta y guardamos el nombre, no debemos
// redirigir todavía. Esta variable nos avisa de eso.
let registrando = false;

// 2. SI YA HAY UNA SESIÓN ABIERTA, IR DIRECTO A NEXA
onAuthStateChanged(auth, (usuario) => {
    if (usuario && !registrando) {
        window.location.replace("index.html");
    }
});

// 3. CAMBIAR ENTRE PESTAÑAS
function mostrarFormulario(cual) {
    const esEntrar = cual === "entrar";
    formEntrar.hidden = !esEntrar;
    formRegistro.hidden = esEntrar;
    pestanaEntrar.classList.toggle("activa", esEntrar);
    pestanaRegistro.classList.toggle("activa", !esEntrar);
    mensaje.textContent = "";
}

pestanaEntrar.addEventListener("click", () => mostrarFormulario("entrar"));
pestanaRegistro.addEventListener("click", () => mostrarFormulario("registro"));

// 4. TRADUCIR LOS ERRORES DE FIREBASE A MENSAJES CLAROS
function textoDeError(error) {
    switch (error.code) {
        case "auth/invalid-email":
            return "El correo no es válido. Revisa que esté bien escrito.";
        case "auth/email-already-in-use":
            return "Ese correo ya tiene una cuenta. Prueba iniciar sesión.";
        case "auth/weak-password":
            return "La contraseña es muy corta. Usa al menos 6 caracteres.";
        case "auth/invalid-credential":
        case "auth/user-not-found":
        case "auth/wrong-password":
            return "Correo o contraseña incorrectos.";
        case "auth/too-many-requests":
            return "Demasiados intentos. Espera unos minutos y vuelve a intentar.";
        case "auth/network-request-failed":
            return "No hay conexión a internet. Revísala e intenta de nuevo.";
        case "auth/operation-not-allowed":
            return "El inicio de sesión con correo no está activado en Firebase.";
        default:
            return "Ocurrió un error inesperado. Código: " + error.code;
    }
}

// 5. INICIAR SESIÓN
formEntrar.addEventListener("submit", async (evento) => {
    evento.preventDefault(); // evita que la página se recargue
    mensaje.textContent = "";

    const correo = document.getElementById("entrar-correo").value.trim();
    const clave = document.getElementById("entrar-clave").value;

    try {
        await signInWithEmailAndPassword(auth, correo, clave);
        window.location.replace("index.html");
    } catch (error) {
        mensaje.textContent = textoDeError(error);
    }
});

// EDAD A PARTIR DE LA FECHA DE NACIMIENTO (formato AAAA-MM-DD)
function calcularEdad(fecha) {
    const hoy = new Date();
    const n = new Date(fecha + "T00:00:00");
    let edad = hoy.getFullYear() - n.getFullYear();
    const mes = hoy.getMonth() - n.getMonth();
    if (mes < 0 || (mes === 0 && hoy.getDate() < n.getDate())) edad--;
    return edad;
}

// 6. CREAR CUENTA
formRegistro.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    mensaje.textContent = "";

    const nombre = document.getElementById("registro-nombre").value.trim();
    const correo = document.getElementById("registro-correo").value.trim();
    const clave = document.getElementById("registro-clave").value;

    if (nombre === "") {
        mensaje.textContent = "Escribe tu nombre.";
        return;
    }

    // VERIFICACIÓN DE EDAD Y ROL
    const rol = document.getElementById("registro-rol").value;
    const nacimiento = document.getElementById("registro-nacimiento").value;
    if (nacimiento === "") {
        mensaje.textContent = "Escribe tu fecha de nacimiento.";
        return;
    }
    const edad = calcularEdad(nacimiento);
    if (isNaN(edad) || edad < 0 || edad > 110) {
        mensaje.textContent = "La fecha de nacimiento no es válida.";
        return;
    }
    if (edad < 13) {
        mensaje.textContent = "NEXA es para personas de 13 años o más. Pide ayuda a un adulto de confianza.";
        return;
    }
    if (rol !== "estudiante" && edad < 18) {
        mensaje.textContent = "Las cuentas de maestro y de padre o madre son solo para mayores de 18 años.";
        return;
    }

    registrando = true;
    try {
        const credencial = await createUserWithEmailAndPassword(auth, correo, clave);
        // Guardamos el nombre en el perfil del usuario
        await updateProfile(credencial.user, { displayName: nombre });
        // Creamos su perfil. Guardamos solo si es menor (sí/no), no la fecha de nacimiento.
        try {
            await setDoc(doc(db, "usuarios", credencial.user.uid), {
                nombre: nombre,
                descripcion: "",
                rol: rol,
                verificado: rol === "estudiante", // maestros y padres se verifican a mano
                menor: edad < 18,
                creado: serverTimestamp()
            });
        } catch (e) {
            console.error(e);
            mensaje.textContent = "Tu cuenta se creó, pero no se pudo guardar tu perfil. Revisa las reglas de Firestore.";
            return;
        }
        window.location.replace("index.html");
    } catch (error) {
        registrando = false;
        mensaje.textContent = textoDeError(error);
    }
});