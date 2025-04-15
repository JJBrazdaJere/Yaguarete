
const inputs = document.querySelectorAll('input[type="number"]');
const totalEl = document.getElementById('total');
const link = document.getElementById('encargar');
const phone = '18097295199';

function actualizarTotal() {
    let total = 0;
    let mensaje = 'Hola! Quiero encargar:%0A';
    inputs.forEach(input => {
        const cantidad = parseInt(input.value) || 0;
        const precio = parseInt(input.dataset.precio);
        if (cantidad > 0) {
            const descripcion = input.previousElementSibling.textContent.trim();
            mensaje += `- ${cantidad} x ${descripcion}%0A`;
            total += cantidad * precio;
        }
    });
    totalEl.textContent = total;
    mensaje += `%0ATotal: RD$${total}`;
    link.href = `https://wa.me/${phone}?text=${mensaje}`;
}

inputs.forEach(input => {
    input.addEventListener('input', actualizarTotal);
});

actualizarTotal();
