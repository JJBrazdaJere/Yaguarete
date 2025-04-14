
function enviarPedido() {
  const coco = document.getElementById("coco").value || 0;
  const maicena = document.getElementById("maicena").value || 0;
  const marplatense = document.getElementById("marplatense").value || 0;
  const mani = document.getElementById("mani").value || 0;

  let mensaje = "¡Hola! Quiero encargar los siguientes alfajores:%0A";

  if (coco > 0) mensaje += "- " + coco + " alfajores de coco%0A";
  if (maicena > 0) mensaje += "- " + maicena + " alfajores de maicena%0A";
  if (marplatense > 0) mensaje += "- " + marplatense + " marplatenses%0A";
  if (mani > 0) mensaje += "- " + mani + " alfajores de maní%0A";

  if (mensaje === "¡Hola! Quiero encargar los siguientes alfajores:%0A") {
    alert("Seleccioná al menos un alfajor para encargar.");
    return;
  }

  window.open("https://wa.me/18097295199?text=" + mensaje, "_blank");
}
