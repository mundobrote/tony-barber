document.addEventListener("DOMContentLoaded", function () {
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const toggleBtn = document.getElementById("togglePassword");
  const loginForm = document.getElementById("loginForm");

  // Auto-focus en el campo de correo
  emailInput?.focus();

  // Toggle para ver/ocultar contraseña
  toggleBtn?.addEventListener("click", function () {
    if (!passwordInput) return;
    const type = passwordInput.getAttribute("type") === "password" ? "text" : "password";
    passwordInput.setAttribute("type", type);
    this.textContent = type === "password" ? "👁️" : "🙈";
  });

  // Limpiar estados de validación al escribir
  document.querySelectorAll(".form-control").forEach((input) => {
    input.addEventListener("input", function () {
      if (this.classList.contains("is-invalid")) {
        this.classList.remove("is-invalid");
      }
    });
  });

  // Procesamiento y Validación del Login
  loginForm?.addEventListener("submit", function (e) {
    e.preventDefault();

    const form = this;
    const submitBtn = form.querySelector('button[type="submit"]');
    const loginText = submitBtn?.querySelector(".login-text");
    const spinner = submitBtn?.querySelector(".spinner-border");

    if (!form.checkValidity()) {
      e.stopPropagation();
      form.classList.add("was-validated");
      return;
    }

    // Activar estado de carga
    if (submitBtn) submitBtn.disabled = true;
    loginText?.classList.add("d-none");
    spinner?.classList.remove("d-none");

    const email = emailInput ? emailInput.value.trim().toLowerCase() : "";
    const contrasenia = passwordInput ? passwordInput.value : "";

    setTimeout(() => {
      // Verificación de credenciales
      if (email === "manzana@gmail.com" && contrasenia === "manzana") {
        window.location.href = "./panel-estadisticas.html";
      } else {
        alert("Credenciales incorrectas.\n\nCorreo: manzana@gmail.com\nContraseña: manzana");
        if (submitBtn) submitBtn.disabled = false;
        loginText?.classList.remove("d-none");
        spinner?.classList.add("d-none");
      }
    }, 400);
  });
});