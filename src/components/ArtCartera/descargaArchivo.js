// Descarga de un Blob ya traído por fetch.
//
// POR QUÉ UN BLOB Y NO UN <a href> AL ENDPOINT: las rutas que exportan
// (PDF de propuesta, CSV de performance) son admin-only con JWT, y un link
// plano del browser no manda el header de Authorization. El archivo bajaría
// igual - con el 401 adentro - y el operador abriría un CSV con un
// {"detail":"Not authenticated"} en la primera celda. Por eso el token se
// manda con fetch y acá sólo se materializa lo que ya llegó.
export const descargarBlobComoArchivo = (blob, nombreArchivo) => {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  URL.revokeObjectURL(url);
};

export default descargarBlobComoArchivo;
