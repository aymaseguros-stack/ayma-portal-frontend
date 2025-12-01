import React, { useState } from 'react';
import { FileDown, Loader } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const ExportarPDF = ({ targetId = 'dashboard-content', nombreArchivo = 'dashboard-ayma' }) => {
  const [exportando, setExportando] = useState(false);

  const exportarPDF = async () => {
    setExportando(true);
    
    try {
      const elemento = document.getElementById(targetId);
      if (!elemento) {
        alert('No se encontró el contenido para exportar');
        return;
      }

      // Configuración de html2canvas
      const canvas = await html2canvas(elemento, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#f9fafb',
        windowWidth: elemento.scrollWidth,
        windowHeight: elemento.scrollHeight
      });

      const imgData = canvas.toDataURL('image/png');
      
      // Crear PDF
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      const imgWidth = pageWidth - 20; // Margen de 10mm cada lado
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      // Header del PDF
      pdf.setFillColor(30, 64, 175); // Azul AYMA
      pdf.rect(0, 0, pageWidth, 20, 'F');
      
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text('AYMA ADVISORS - Dashboard Ejecutivo', 10, 13);
      
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      const fecha = new Date().toLocaleString('es-AR', { 
        dateStyle: 'long', 
        timeStyle: 'short' 
      });
      pdf.text(`Generado: ${fecha}`, pageWidth - 70, 13);

      // Si la imagen es más alta que la página, crear múltiples páginas
      let yPosition = 25;
      let remainingHeight = imgHeight;
      let sourceY = 0;

      while (remainingHeight > 0) {
        const availableHeight = pageHeight - yPosition - 10;
        const heightToUse = Math.min(availableHeight, remainingHeight);
        
        // Calcular qué porción del canvas usar
        const sourceHeight = (heightToUse / imgHeight) * canvas.height;
        
        // Crear un canvas temporal con solo la porción necesaria
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = sourceHeight;
        const ctx = tempCanvas.getContext('2d');
        ctx.drawImage(
          canvas, 
          0, sourceY, canvas.width, sourceHeight,
          0, 0, canvas.width, sourceHeight
        );
        
        const tempImgData = tempCanvas.toDataURL('image/png');
        pdf.addImage(tempImgData, 'PNG', 10, yPosition, imgWidth, heightToUse);
        
        remainingHeight -= heightToUse;
        sourceY += sourceHeight;
        
        if (remainingHeight > 0) {
          pdf.addPage();
          yPosition = 10;
        }
      }

      // Footer en la última página
      pdf.setTextColor(128, 128, 128);
      pdf.setFontSize(8);
      pdf.text(
        'AYMA Advisors - Gestores de Riesgos | www.aymaseguros.com.ar', 
        pageWidth / 2, 
        pageHeight - 5, 
        { align: 'center' }
      );

      // Descargar
      const fechaArchivo = new Date().toISOString().split('T')[0];
      pdf.save(`${nombreArchivo}-${fechaArchivo}.pdf`);

    } catch (error) {
      console.error('Error exportando PDF:', error);
      alert('Error al exportar PDF. Intente nuevamente.');
    } finally {
      setExportando(false);
    }
  };

  return (
    <button
      onClick={exportarPDF}
      disabled={exportando}
      className={`px-4 py-2 rounded-lg flex items-center gap-2 transition ${
        exportando 
          ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
          : 'bg-green-600 text-white hover:bg-green-700'
      }`}
    >
      {exportando ? (
        <>
          <Loader size={18} className="animate-spin" />
          Generando PDF...
        </>
      ) : (
        <>
          <FileDown size={18} />
          Exportar PDF
        </>
      )}
    </button>
  );
};

export default ExportarPDF;
