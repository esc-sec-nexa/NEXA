// scripts/chat.js
// Chat privado. Solo entre amigos aceptados.
// Los mensajes viven en chats/{idChat}/mensajes, con idChat = uidA_uidB (ordenados).

import {
    db, collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp
} from "../firebase-config.js";
import { revisarTexto, mensajeDeBloqueo } from "./moderacion.js";
import { alCambiarAmigos } from "./amigos.js";

const listaChats = document.getElementById("lista-chats");
const panel = document.getElementById("panel-chat");
const titulo = document.getElementById("chat-titulo");
const contenedor = document.getElementById("chat-mensajes");
const formulario = document.getElementById("form-chat");
const campo = document.getElementById("chat-texto");
const mensaje = document.getElementById("mensaje-chat");

let yo = null;
let amigoActivo = null;
let detener = null;

export function iniciarChat(usuario) {
    yo = usuario;
    alCambiarAmigos(dibujarAmigos);
    formulario.addEventListener("submit", enviar);
}

export function detenerChat() {
    if (detener) { detener(); detener = null; }
}

function idChat(a, b) { return [a, b].sort().join("_"); }

function dibujarAmigos(amigos) {
    listaChats.replaceChildren();
    if (amigos.length === 0) {
        const p = document.createElement("p");
        p.className = "vacio";
        p.textContent = "Cuando tengas amigos aceptados podrás chatear con ellos aquí.";
        listaChats.append(p);
        return;
    }
    amigos.forEach((a) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "btn-accion" + (amigoActivo && amigoActivo.uid === a.uid ? " principal" : "");
        b.textContent = a.nombre || "Estudiante";
        b.addEventListener("click", () => abrirChat(a));
        listaChats.append(b);
    });
}

function abrirChat(amigo) {
    amigoActivo = amigo;
    detenerChat();
    panel.hidden = false;
    titulo.textContent = "Chat con " + (amigo.nombre || "Estudiante");
    contenedor.replaceChildren();
    mensaje.textContent = "";

    const consulta = query(
        collection(db, "chats", idChat(yo.uid, amigo.uid), "mensajes"),
        orderBy("creada", "desc"),
        limit(100)
    );
    detener = onSnapshot(consulta, (c) => {
        contenedor.replaceChildren();
        c.docs.slice().reverse().forEach((d) => {
            const datos = d.data();
            const burbuja = document.createElement("div");
            burbuja.className = "burbuja " + (datos.de === yo.uid ? "mia" : "suya");
            burbuja.textContent = datos.texto; // textContent: nadie puede inyectar HTML
            contenedor.append(burbuja);
        });
        contenedor.scrollTop = contenedor.scrollHeight;
    }, (error) => {
        console.error(error);
        mensaje.textContent = "No se pudo cargar el chat. Revisa las reglas de Firestore.";
    });
}

async function enviar(evento) {
    evento.preventDefault();
    mensaje.textContent = "";
    const texto = campo.value.trim();
    if (texto === "" || !amigoActivo) return;

    const revision = revisarTexto(texto);
    if (!revision.ok) {
        mensaje.textContent = mensajeDeBloqueo(revision.motivo);
        return;
    }

    try {
        await addDoc(collection(db, "chats", idChat(yo.uid, amigoActivo.uid), "mensajes"), {
            de: yo.uid,
            texto: texto,
            creada: serverTimestamp()
        });
        campo.value = "";
    } catch (error) {
        console.error(error);
        mensaje.textContent = "No se pudo enviar el mensaje.";
    }
}
