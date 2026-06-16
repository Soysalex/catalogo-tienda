const SUPABASE_URL = "https://cmovggyxmtzeqcazolvx.supabase.co"; 
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNtb3ZnZ3l4bXR6ZXFjYXpvbHZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1Njk5NjAsImV4cCI6MjA5NzE0NTk2MH0.OFbTJz22iPp2Jdv7z1l6M67wTKanmeousGXgygOILA8";

const clienteSupabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const CONTRASENA_ADMIN = "neibys43"; // <-- CAMBIA ESTA CONTRASEÑA, DAVID
let inventarioGlobal = []; // Para guardar los datos en memoria y no recargar tanto

// --- MENÚ Y VISTAS ---
function toggleMenu() {
    document.getElementById('dropdown-menu').classList.toggle('oculto');
}

function pedirPassword() {
    toggleMenu(); // Cerramos el menú
    const intento = prompt("Acceso restringido. Ingrese la contraseña de administrador:");
    
    if (intento === CONTRASENA_ADMIN) {
        verVista('admin');
        cargarAdminList(); // Cargamos la tabla de edición
    } else if (intento !== null) {
        alert("Contraseña incorrecta. Intento bloqueado.");
    }
}

function verVista(vista) {
    document.getElementById('vista-cliente').classList.add('oculto');
    document.getElementById('vista-admin').classList.add('oculto');
    
    if (vista === 'cliente') {
        document.getElementById('vista-cliente').classList.remove('oculto');
        cargarProductos();
    } else {
        document.getElementById('vista-admin').classList.remove('oculto');
    }
    
    // Si veníamos del menú, nos aseguramos que esté cerrado
    document.getElementById('dropdown-menu').classList.add('oculto');
}

// --- FORMULARIO (CREAR O EDITAR) ---
const formulario = document.getElementById('formulario-producto');
const btnGuardar = document.getElementById('btn-guardar');

formulario.addEventListener('submit', async (e) => {
    e.preventDefault(); 
    
    btnGuardar.textContent = "Procesando... Por favor espera.";
    btnGuardar.disabled = true;

    const idEdicion = document.getElementById('producto-id').value;
    const nombre = document.getElementById('nombre').value;
    const precio = document.getElementById('precio').value;
    const descripcion = document.getElementById('descripcion').value;
    const archivoImagen = document.getElementById('imagen').files[0];

    try {
        let urlFinalImagen = null;

        // Si hay una foto nueva, la subimos
        if (archivoImagen) {
            const nombreArchivo = `${Date.now()}_${archivoImagen.name}`;
            const { error: errorStorage } = await clienteSupabase
                .storage.from('imagenes-productos').upload(nombreArchivo, archivoImagen);
            if (errorStorage) throw errorStorage;

            const { data: dataUrl } = clienteSupabase
                .storage.from('imagenes-productos').getPublicUrl(nombreArchivo);
            urlFinalImagen = dataUrl.publicUrl;
        }

        if (idEdicion) {
            // MODO ACTUALIZAR
            const actualizaciones = { nombre, precio, descripcion };
            if (urlFinalImagen) actualizaciones.imagen_url = urlFinalImagen; // Solo actualiza foto si subió una nueva

            const { error } = await clienteSupabase.from('productos').update(actualizaciones).eq('id', idEdicion);
            if (error) throw error;
            alert("¡Producto actualizado con éxito!");
            cancelarEdicion(); // Limpiamos el modo edición
        } else {
            // MODO CREAR NUEVO
            if (!urlFinalImagen) throw new Error("La foto es obligatoria para un producto nuevo.");
            
            const { error } = await clienteSupabase.from('productos').insert([
                { nombre, precio, descripcion, imagen_url: urlFinalImagen }
            ]);
            if (error) throw error;
            alert("¡Producto añadido con éxito!");
            formulario.reset();
        }

        cargarAdminList(); // Refrescamos la lista de abajo

    } catch (error) {
        console.error("Error:", error);
        alert("Hubo un error: " + error.message);
    } finally {
        btnGuardar.textContent = idEdicion ? "Actualizar Producto" : "Guardar Producto";
        btnGuardar.disabled = false;
    }
});

// --- FUNCIONES DE ADMINISTRACIÓN ---
async function cargarAdminList() {
    const lista = document.getElementById('lista-admin');
    lista.innerHTML = "<p>Cargando inventario...</p>";

    const { data: productos, error } = await clienteSupabase.from('productos').select('*');
    if (error) { lista.innerHTML = "<p>Error cargando la lista.</p>"; return; }

    inventarioGlobal = productos; // Guardamos en la variable global
    lista.innerHTML = "";

    if (productos.length === 0) {
        lista.innerHTML = "<p>No hay productos en el sistema.</p>";
        return;
    }

    productos.forEach(prod => {
        lista.innerHTML += `
            <div class="item-admin">
                <span class="item-info">${prod.nombre} - $${prod.precio}</span>
                <div>
                    <button onclick="prepararEdicion(${prod.id})" class="btn-amarillo">Editar</button>
                    <button onclick="eliminarProducto(${prod.id})" class="btn-rojo">Eliminar</button>
                </div>
            </div>
        `;
    });
}

function prepararEdicion(id) {
    const prod = inventarioGlobal.find(p => p.id === id);
    if (!prod) return;

    document.getElementById('producto-id').value = prod.id;
    document.getElementById('nombre').value = prod.nombre;
    document.getElementById('precio').value = prod.precio;
    document.getElementById('descripcion').value = prod.descripcion;
    
    // La imagen no es obligatoria al editar
    document.getElementById('imagen').required = false;
    document.getElementById('nota-imagen').classList.remove('oculto');
    
    document.getElementById('btn-guardar').textContent = "Actualizar Producto";
    document.getElementById('btn-cancelar').classList.remove('oculto');
    
    // Hacemos scroll hacia arriba para que vea el formulario
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelarEdicion() {
    formulario.reset();
    document.getElementById('producto-id').value = "";
    document.getElementById('imagen').required = true;
    document.getElementById('nota-imagen').classList.add('oculto');
    document.getElementById('btn-guardar').textContent = "Guardar Producto";
    document.getElementById('btn-cancelar').classList.add('oculto');
}

async function eliminarProducto(id) {
    const confirmacion = confirm("¿Estás seguro de que deseas eliminar este producto? Esta acción no se puede deshacer.");
    if (confirmacion) {
        try {
            const { error } = await clienteSupabase.from('productos').delete().eq('id', id);
            if (error) throw error;
            
            alert("Producto eliminado.");
            cargarAdminList();
        } catch (error) {
            alert("Error eliminando el producto: " + error.message);
        }
    }
}

// --- MOSTRAR PRODUCTOS AL CLIENTE (IGUAL QUE ANTES) ---
async function cargarProductos() {
    const contenedor = document.getElementById('contenedor-productos');
    contenedor.innerHTML = "<p>Cargando catálogo...</p>";

    try {
        const { data: productos, error } = await clienteSupabase.from('productos').select('*');
        if (error) throw error;

        if (productos.length === 0) {
            contenedor.innerHTML = "<p>No hay productos disponibles por ahora.</p>";
            return;
        }

        contenedor.innerHTML = "";
        
        productos.forEach(prod => {
            const tlf = "584121468873"; 
            const msg = encodeURIComponent(`Hola! Me interesa el producto: ${prod.nombre} ($${prod.precio}). ¿Está disponible?`);
            const linkWhatsapp = `https://wa.me/${tlf}?text=${msg}`;

            contenedor.innerHTML += `
                <div class="tarjeta-prod">
                    <img src="${prod.imagen_url}" alt="${prod.nombre}" style="max-width: 100%; border-radius: 8px;">
                    <h3>${prod.nombre}</h3>
                    <p class="precio"><strong>$${prod.precio}</strong></p>
                    <p class="desc">${prod.descripcion}</p>
                    <a href="${linkWhatsapp}" target="_blank" class="btn-wa">Pedir por WhatsApp</a>
                </div>
            `;
        });

    } catch (error) {
        console.error("Error:", error);
        contenedor.innerHTML = "<p>Error al cargar el catálogo.</p>";
    }
}

// --- MODO OSCURO (LÓGICA Y MEMORIA) ---
function toggleModoOscuro() {
    const body = document.body;
    const checkbox = document.getElementById('toggle-oscuro');
    
    if (checkbox.checked) {
        body.setAttribute('data-theme', 'dark');
        localStorage.setItem('tema', 'dark'); // Guardamos en el navegador
    } else {
        body.removeAttribute('data-theme');
        localStorage.setItem('tema', 'light');
    }
}

// Esta función se ejecuta apenas carga la página para revisar qué tema estaba guardado
window.addEventListener('DOMContentLoaded', () => {
    const temaGuardado = localStorage.getItem('tema');
    if (temaGuardado === 'dark') {
        document.body.setAttribute('data-theme', 'dark');
        document.getElementById('toggle-oscuro').checked = true;
    }
});

cargarProductos();
