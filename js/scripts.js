// Horarios estándar
const HORARIOS_LABORALES = [
  "10:00", "11:00", "12:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"
];

let pasoActual = 0;
const regexTelefono = /^[0-9]{7,15}$/;
const regexEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const data = {
  fechaHora: "",
  cliente: { nombre: "", apellido: "", telefono: "", email: "" },
  servicio: { id: 0, tipo: "", precio: 0 },
};

function tieneValor(input) {
  if (input.offsetParent === null) return true;
  if (input.hasAttribute("required") && !input.value.trim()) {
    input.classList.add("is-invalid");
    return false;
  } else {
    input.classList.remove("is-invalid");
    return true;
  }
}

function mostrarError(mensaje) {
  const modalMensaje = document.getElementById("modalErrorMensaje");
  if (modalMensaje && typeof bootstrap !== "undefined") {
    modalMensaje.textContent = mensaje;
    const modal = new bootstrap.Modal(document.getElementById("modalError"));
    modal.show();
  } else {
    alert(mensaje);
  }
}

// Carga de horarios al cambiar fecha
window.cargarHorariosDisponibles = function () {
  const inputFecha = document.getElementById("fecha");
  const contenedor = document.getElementById("horarios");
  if (!inputFecha || !contenedor) return;

  if (!inputFecha.min) {
    inputFecha.min = new Date().toISOString().split("T")[0];
  }

  const fecha = inputFecha.value;
  contenedor.innerHTML = "";
  if (!fecha) return;

  HORARIOS_LABORALES.forEach(hora => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "input-opcion";
    btn.textContent = hora;

    btn.onclick = () => {
      document.querySelectorAll(".input-opcion").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
    };

    contenedor.appendChild(btn);
  });
};

// Navegación de pasos
window.siguientePaso = function (paso) {
  const secciones = document.querySelectorAll(".seccion");
  const seccionActiva = document.querySelector(".seccion.activa");
  if (!seccionActiva) return;

  const inputs = seccionActiva.querySelectorAll("input, select");
  for (let input of inputs) {
    if (!tieneValor(input)) {
      mostrarError("Por favor, completa todos los campos obligatorios.");
      return;
    }
  }

  if (seccionActiva.id === "paso-2") {
    const horarioSeleccionado = seccionActiva.querySelector(".input-opcion.selected");
    if (!horarioSeleccionado) {
      mostrarError("Por favor, selecciona un horario.");
      return;
    }
  }

  secciones[paso - 1].classList.remove("activa");
  secciones[paso].classList.add("activa");
  pasoActual = paso;
};

window.volverPaso = function (paso) {
  const secciones = document.querySelectorAll(".seccion");
  secciones[pasoActual].classList.remove("activa");
  secciones[paso - 1].classList.add("activa");
  pasoActual = paso - 1;
};

// Enviar formulario
window.enviarForm = function () {
  const nombre = document.getElementById("nombre").value.trim();
  const apellido = document.getElementById("apellido").value.trim();
  const telefono = document.getElementById("telefono").value.trim();
  const email = document.getElementById("email").value.trim();
  const selectServicio = document.getElementById("servicio");
  const servicioId = parseInt(selectServicio.value);
  const fecha = document.getElementById("fecha").value;
  const hora = document.querySelector(".input-opcion.selected")?.textContent || "";

  if (!nombre || !apellido || !telefono || !email || !fecha || !hora || !servicioId) {
    mostrarError("Por favor, completa todos los campos obligatorios.");
    return;
  }

  if (!regexTelefono.test(telefono)) {
    mostrarError("Ingresa un número de teléfono válido.");
    return;
  }
  if (!regexEmail.test(email)) {
    mostrarError("Ingresa un correo electrónico válido.");
    return;
  }

  data.fechaHora = `${fecha}T${hora}`;
  data.cliente = { nombre, apellido, telefono, email };
  data.servicio = {
    id: servicioId,
    tipo: selectServicio.selectedOptions[0].text,
    precio: parseFloat(selectServicio.selectedOptions[0].dataset.precio || 0)
  };

  const citas = JSON.parse(localStorage.getItem("turnos_barberia") || "[]");
  citas.push({ id: Date.now(), ...data, estado: "confirmado" });
  localStorage.setItem("turnos_barberia", JSON.stringify(citas));

  window.location.href = "reserva-confirmada.html";
};