// scripts/perfil.js
// Perfil: nombre y descripción guardados en la colección "usuarios".

import { auth, db, doc, getDoc, setDoc, serverTimestamp, updateProfile } from "../firebase-config.js";

export async function iniciarPerfil(usuario, etiquetaNombre) {
    const formulario = document.getElementById("form-perfil");
    const campoNombre = document.getElementById("perfil-nombre");
    const campoDescripcion = document.getElementById("perfil-descripcion");
    const mensaje = document.getElementById("mensaje-perfil");
    const referencia = doc(db, "usuarios", usuario.uid);
    const nombreInicial = usuario.displayName || usuario.email;

    // Cargar el perfil (o crearlo si es una cuenta anterior a esta versión)
    try {
        const captura = await getDoc(referencia);
        if (!captura.exists()) {
            await setDoc(referencia, { nombre: nombreInicial, descripcion: "", creado: serverTimestamp() });
        }
        const datos = captura.exists() ? captura.data() : {};
        campoNombre.value = datos.nombre || nombreInicial;
        campoDescripcion.value = datos.descripcion || "";
    } catch (error) {
        console.error(error);
        mensaje.textContent = "No se pudo cargar tu perfil. Revisa las reglas de Firestore.";
    }

    // Guardar cambios
    formulario.addEventListener("submit", async (evento) => {
        evento.preventDefault();
        mensaje.style.color = "";
        mensaje.textContent = "";

        const nombre = campoNombre.value.trim();
        if (nombre === "") {
            mensaje.textContent = "El nombre no puede estar vacío.";
            return;
        }

        try {
            await setDoc(referencia, {
                nombre: nombre,
                descripcion: campoDescripcion.value.trim()
            }, { merge: true });
            await updateProfile(auth.currentUser, { displayName: nombre });
            etiquetaNombre.textContent = nombre;
            mensaje.style.color = "#1b7a3d";
            mensaje.textContent = "Perfil guardado.";
        } catch (error) {
            console.error(error);
            mensaje.textContent = "No se pudo guardar. Intenta de nuevo.";
        }
    });
}
