
/*
 * NEXA 0.2 — Moderación de mensajes
 *
 * Detecta:
 * - Groserías y variantes intencionales.
 * - Insultos discriminatorios y expresiones de odio.
 * - Amenazas y deseos de violencia.
 * - Teléfonos, correos, enlaces y posibles ubicaciones.
 * - Intentos de compartir contactos externos.
 *
 * IMPORTANTE:
 * Este módulo es una primera barrera en el navegador.
 * La validación definitiva debe repetirse en el servidor.
 */

// ======================================================
// 1. LISTAS DE PALABRAS
// ======================================================

const GROSERIAS = [
    "puto", "puta", "putos", "putas",
    "pendejo", "pendeja", "pendejos", "pendejas",
    "chingar", "chingada", "chingado", "chingadera",
    "verga", "vergas", "mamada", "mierda",
    "culero", "culera", "cabron", "cabrona",
    "ojete", "carajo", "joder", "hijueputa",
    "hdp", "ctm", "mamon", "mamona",
    "zorra", "estupido", "estupida",
    "imbecil", "tarado", "tarada",
    "malparido", "pinche", "pendejadas"
];

const ODIO = [
    "maricon", "maricones", "marica",
    "joto", "jotos", "mariposon",
    "sudaca", "negrata", "nigger",
    "nigga", "faggot", "tranny"
];

// Términos que requieren contexto para no bloquear
// automáticamente conversaciones informativas.
const TERMINOS_SENSIBLES = [
    "nazi", "mongolo", "retrasado", "retrasada"
];

// ======================================================
// 2. NORMALIZACIÓN
// ======================================================

function quitarAcentos(texto) {
    return texto
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function colapsarRepeticiones(texto) {
    // "matt aar" no se trata igual que "matt aar":
    // se eliminan repeticiones de caracteres consecutivos.
    return texto.replace(/(.)\1+/g, "$1");
}

function normalizar(texto) {
    let t = quitarAcentos(String(texto).toLowerCase());

    // Variantes frecuentes de escritura.
    t = t
        .replace(/[@4]/g, "a")
        .replace(/[3]/g, "e")
        .replace(/[1!|]/g, "i")
        .replace(/[0]/g, "o")
        .replace(/[$5]/g, "s")
        .replace(/[7]/g, "t");

    // Elimina repeticiones: "mattarr" -> "matar".
    t = colapsarRepeticiones(t);

    // Conserva letras, números y separadores.
    t = t.replace(/[^a-z0-9]+/g, " ").trim();

    // "m a t a r" -> "matar", pero sin unir
    // indiscriminadamente todas las palabras del mensaje.
    t = t.replace(
        /\b(?:[a-z]\s+){2,}[a-z]\b/g,
        coincidencia => coincidencia.replace(/\s+/g, "")
    );

    return t.replace(/\s+/g, " ").trim();
}

function tokensDe(texto) {
    return normalizar(texto)
        .split(" ")
        .filter(Boolean);
}

// ======================================================
// 3. COMPARACIÓN APROXIMADA
// ======================================================

// Distancia de edición de Levenshtein.
// Permite detectar errores de una letra.
function distanciaEdicion(a, b) {
    if (a === b) return 0;

    if (Math.abs(a.length - b.length) > 2) {
        return 3;
    }

    let anterior = Array.from(
        { length: b.length + 1 },
        (_, i) => i
    );

    for (let i = 1; i <= a.length; i++) {
        const actual = [i];

        for (let j = 1; j <= b.length; j++) {
            actual[j] = Math.min(
                actual[j - 1] + 1,
                anterior[j] + 1,
                anterior[j - 1] + (
                    a[i - 1] === b[j - 1] ? 0 : 1
                )
            );
        }

        anterior = actual;
    }

    return anterior[b.length];
}

function palabraParecida(palabra, objetivo) {
    if (palabra === objetivo) return true;

    // Para palabras cortas exigimos coincidencia exacta.
    // Reduce falsos positivos en palabras normales.
    if (objetivo.length < 5 || palabra.length < 5) {
        return false;
    }

    return distanciaEdicion(palabra, objetivo) <= 1;
}

// ======================================================
// 4. PATRONES DE SEGURIDAD
// ======================================================

const PATRONES = [
    {
        motivo: "una posible amenaza de violencia",
        regex: /\b(?:te voy a (?:matar|golpear|pegar|violar)|voy a matarte|matate|suicidate|ojala te mueras|ojala mueras|mereces morir|muerte a los|muerte a las)\b/
    },
    {
        motivo: "contenido sexual explícito o solicitud de desnudos",
        regex: /\b(?:nudes?|desnuda|desnudo|desnudas|desnudos)\b/
    },
    {
        motivo: "un intento de compartir contactos externos",
        regex: /\b(?:whatsapp|wasap|telegram|snapchat|pasame tu numero|pasame tu whats|dame tu numero|dame tu whats|dame tu cel|dame tu direccion)\b/
    },
    {
        motivo: "una posible dirección o ubicación privada",
        regex: /\b(?:mi direccion es|mi domicilio es|mi casa esta en|vivo en la calle|vivo en la colonia|calle|avenida|boulevard|fraccionamiento|privada|andador|calzada|carretera)\s+[a-z0-9 ]{1,35}\b/
    }
];

// Las amenazas se comparan también con errores de escritura.
// Se tolera una palabra adicional para casos como
// "te voy a intentar matar".
const AMENAZAS = [
    ["te", "voy", "a", "matar"],
    ["te", "voy", "a", "golpear"],
    ["te", "voy", "a", "pegar"],
    ["te", "voy", "a", "violar"],
    ["voy", "a", "matarte"],
    ["ojala", "te", "mueras"],
    ["ojala", "mueras"],
    ["mereces", "morir"],
    ["muerte", "a", "los"],
    ["muerte", "a", "las"],
    ["heil", "hitler"]
];

function tokenCoincide(token, objetivo) {
    return palabraParecida(token, objetivo);
}

function buscarFraseAproximada(tokens, frase) {
    // Solo se tolera una palabra adicional en la frase.
    for (
        let inicio = 0;
        inicio < tokens.length;
        inicio++
    ) {
        for (
            let extra = 0;
            extra <= 1;
            extra++
        ) {
            const longitud = frase.length + extra;
            const final = inicio + longitud;

            if (final > tokens.length) continue;

            const fragmento = tokens.slice(inicio, final);

            let indiceFrase = 0;
            let coincidencias = 0;

            for (const token of fragmento) {
                if (indiceFrase >= frase.length) break;

                if (tokenCoincide(token, frase[indiceFrase])) {
                    indiceFrase++;
                    coincidencias++;
                } else if (extra === 1 && coincidencias > 0) {
                    // Una palabra intermedia puede ser adicional.
                    continue;
                } else {
                    break;
                }
            }

            if (indiceFrase === frase.length) {
                return true;
            }
        }
    }

    return false;
}

// ======================================================
// 5. DATOS PERSONALES
// ======================================================

const CRUDOS = [
    {
        motivo: "un correo electrónico",
        regex: /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/i
    },
    {
        motivo: "un enlace externo",
        regex: /(?:https?:\/\/|www\.)\S+/i
    },
    {
        motivo: "coordenadas geográficas",
        regex: /-?\d{1,3}\.\d{3,}\s*,\s*-?\d{1,3}\.\d{3,}/
    }
];

function contieneTelefono(texto) {
    // Evita considerar cualquier número corto como teléfono.
    // Se requieren al menos 8 dígitos, separados o no.
    const digitos = texto.replace(/\D/g, "");

    if (digitos.length < 8 || digitos.length > 15) {
        return false;
    }

    return /(?:\+?\d[\s().-]*){8,}/.test(texto);
}

// ======================================================
// 6. REVISIÓN PRINCIPAL
// ======================================================

const SET_GROSERIAS = new Set(GROSERIAS.map(normalizar));
const SET_ODIO = new Set(ODIO.map(normalizar));

export function revisarTexto(texto) {
    if (typeof texto !== "string") {
        return {
            ok: false,
            motivo: "un mensaje no válido"
        };
    }

    if (texto.length > 2000) {
        return {
            ok: false,
            motivo: "un mensaje demasiado largo"
        };
    }

    const original = texto.trim();

    if (!original) {
        return {
            ok: false,
            motivo: "un mensaje vacío"
        };
    }

    // Detecta datos personales antes de normalizar.
    for (const regla of CRUDOS) {
        if (regla.regex.test(original)) {
            return {
                ok: false,
                motivo: regla.motivo
            };
        }
    }

    if (contieneTelefono(original)) {
        return {
            ok: false,
            motivo: "un posible número de teléfono"
        };
    }

    const limpio = normalizar(original);
    const tokens = limpio.split(" ").filter(Boolean);

    // Detecta amenazas con tolerancia a errores.
    for (const amenaza of AMENAZAS) {
        if (buscarFraseAproximada(tokens, amenaza)) {
            return {
                ok: false,
                motivo: "una posible amenaza de violencia"
            };
        }
    }

    for (const regla of PATRONES) {
        if (regla.regex.test(limpio)) {
            return {
                ok: false,
                motivo: regla.motivo
            };
        }
    }

    // Insultos: coincidencia exacta tras normalización.
    for (const palabra of tokens) {
        if (SET_GROSERIAS.has(palabra)) {
            return {
                ok: false,
                motivo: "lenguaje ofensivo"
            };
        }

        if (SET_ODIO.has(palabra)) {
            return {
                ok: false,
                motivo: "un posible mensaje de odio"
            };
        }
    }

    // Términos ambiguos: no se bloquean automáticamente.
    // Se recomienda revisión contextual en el servidor.
    return { ok: true };
}

// ======================================================
// 7. MENSAJES DE BLOQUEO
// ======================================================

export function mensajeDeBloqueo(motivo) {
    const mensajes = {
        "una posible amenaza de violencia":
            "Tu mensaje podría interpretarse como una amenaza. Reformúlalo sin amenazar a nadie.",

        "un posible mensaje de odio":
            "Tu mensaje podría contener lenguaje discriminatorio. Revísalo antes de publicarlo.",

        "lenguaje ofensivo":
            "Intenta expresar tu idea sin insultos.",

        "un correo electrónico":
            "Por seguridad, no publiques direcciones de correo personales.",

        "un enlace externo":
            "No se permiten enlaces externos en esta versión de NEXA.",

        "un posible número de teléfono":
            "Por seguridad, evita publicar números de teléfono.",

        "coordenadas geográficas":
            "No publiques coordenadas que puedan revelar una ubicación privada.",

        "una posible dirección o ubicación privada":
            "Protege tu privacidad: evita compartir direcciones particulares.",

        "un intento de compartir contactos externos":
            "Mantén la conversación dentro de NEXA.",

        "contenido sexual explícito o solicitud de desnudos":
            "Este contenido no está permitido en NEXA.",

        "un mensaje vacío":
            "Escribe un mensaje antes de publicarlo.",

        "un mensaje demasiado largo":
            "Tu mensaje supera el límite permitido.",

        "un mensaje no válido":
            "No se pudo validar el mensaje. Inténtalo de nuevo."
    };

    return mensajes[motivo] ||
        "No se puede enviar este mensaje. Revísalo e inténtalo de nuevo.";
}
