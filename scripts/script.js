
function cambiarCantidad(boton, cambio) {
    const input = boton.parentElement.querySelector('input');
    let valor = parseInt(input.value) || 0;
    valor += cambio;
    if (valor < 0) valor = 0;
    input.value = valor;
  
    actualizarTotal();
  }
  
  function actualizarTotal() {
    const inputs = document.querySelectorAll('.cantidad-control input');
    let total = 0;
  
    inputs.forEach(input => {
      const cantidad = parseInt(input.value) || 0;
      const precio = parseFloat(input.dataset.precio) || 0;
      total += cantidad * precio;
    });
  
    document.getElementById('total').textContent = `Total: RD$${total}`;
  }
  
  // También actualizamos el total cuando se escribe manualmente en el input
  document.querySelectorAll('.cantidad-control input').forEach(input => {
    input.addEventListener('input', actualizarTotal);
  });
  document.getElementById('boton-encargar').addEventListener('click', function (e) {
    e.preventDefault();
  
    const productos = document.querySelectorAll('.producto');
    let mensaje = "Hola. Quisiera hacer un pedido, este es el resumen:%0A%0A";
    mensaje += "  *Resumen de mi compra:*%0A";
    let total = 0;
  
    productos.forEach(producto => {
      const nombre = producto.querySelector('.nombre')?.textContent.trim() || "Producto";
      const input = producto.querySelector('input');
      const cantidad = parseInt(input.value) || 0;
      const precioUnitario = parseFloat(input.dataset.precio) || 0;
  
      if (cantidad > 0) {
        const subtotal = cantidad * precioUnitario;
        total += subtotal;
        mensaje += `• ${nombre} x${cantidad} – (RD$${precioUnitario} c/u) = RD$${subtotal}%0A`;
      }
    });
  
    if (total === 0) {
      alert("No has seleccionado ningún producto.");
      return;
    }
  
    mensaje += `%0A *Total a pagar: RD$${total}*%0A%0A`;
    mensaje += "Por favor, confirmame la disponibilidad y el tiempo estimado de entrega";
  
    const numero = "18097295199"; // Tu número
    const url = `https://wa.me/${numero}?text=${mensaje}`;
    window.open(url, "_blank");
  });
  
  
