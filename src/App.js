import React, { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { PDFDocument } from 'pdf-lib';
import './App.css';

const App = () => {
  const [files, setFiles] = useState([]);
  const [pdfBlob, setPdfBlob] = useState(null);
  const [isConverting, setIsConverting] = useState(false);

  const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
    if (acceptedFiles.some(file => file.type === 'application/pdf')) {
      alert('PDF files are not allowed.');
    }
    if (rejectedFiles.length > 0) {
      alert(
        `Rejected files: ${rejectedFiles
          .map(f => f.file.name)
          .join(', ')}\nPlease upload valid image files.`
      );
    }

    // Filter out PDF files explicitly.
    const filteredFiles = acceptedFiles.filter(file => file.type !== 'application/pdf');

    setFiles(prev => [
      ...prev,
      ...filteredFiles.map(file => ({
        id: crypto.randomUUID(),
        file,
        preview: URL.createObjectURL(file),
      })),
    ]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpeg', '.jpg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
      'image/gif': ['.gif'],
      'image/bmp': ['.bmp'],
      'image/tiff': ['.tiff', '.tif'],
      'image/svg+xml': ['.svg']
    },
    maxSize: 50 * 1024 * 1024 // 50MB
  });

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    const items = Array.from(files);
    const [reordered] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reordered);
    setFiles(items);
  };

  const generatePdf = async () => {
    setIsConverting(true);
    try {
      const pdfDoc = await PDFDocument.create();

      for (const { file } of files) {
        try {
          const imgBytes = await file.arrayBuffer();
          const fileExtension = file.name.split('.').pop().toLowerCase();
          let image;

          if (file.type === 'image/png' || fileExtension === 'png') {
            image = await pdfDoc.embedPng(imgBytes);
          } else if (['image/jpeg', 'image/jpg'].includes(file.type) || ['jpeg', 'jpg'].includes(fileExtension)) {
            image = await pdfDoc.embedJpg(imgBytes);
          } else {
            const img = await createImageBitmap(file);
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const pngBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
            image = await pdfDoc.embedPng(await pngBlob.arrayBuffer());
          }

          const page = pdfDoc.addPage([image.width, image.height]);
          page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
        } catch (error) {
          console.error(`Error processing ${file.name}:`, error);
          alert(`Failed to process ${file.name}: ${error.message}`);
        }
      }

      const pdfBytes = await pdfDoc.save();
      const newBlob = new Blob([pdfBytes], { type: 'application/pdf' });

      if (pdfBlob) URL.revokeObjectURL(pdfBlob);
      setPdfBlob(newBlob);
    } catch (error) {
      console.error('PDF generation failed:', error);
      alert('Failed to generate PDF. Please check the console for details.');
    }
    setIsConverting(false);
  };

  const removeFile = (id) => {
    setFiles(prev => prev.filter(file => file.id !== id));
  };

  const clearAllFiles = () => {
    setFiles([]);
    setPdfBlob(null);
  };

  useEffect(() => {
    return () => files.forEach(file => URL.revokeObjectURL(file.preview));
  }, [files]);

  return (
    <div>
      <nav className="menu-bar">
        <h2>PDF Converter</h2>
      </nav>
      
      <div className="container">
        <h1 className="title">Universal Image to PDF Converter</h1>

        <div {...getRootProps()} className={`dropzone ${isDragActive ? 'dropzone-active' : ''}`}>
          <input {...getInputProps()} />
          <p className="dropzone-text">
            {isDragActive 
              ? 'Drop your image files here' 
              : 'Drag & drop images (JPEG, PNG, WEBP, GIF, BMP, TIFF, SVG), or click to select'}
          </p>
        </div>

        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="files">
            {provided => (
              <div {...provided.droppableProps} ref={provided.innerRef} className="image-grid">
                {files.map((file, index) => (
                  <Draggable key={file.id} draggableId={file.id} index={index}>
                    {provided => (
                      <div 
                        className="image-box"
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                      >
                        <img src={file.preview} alt="preview" className="image-preview" />
                        <button className="delete-btn" onClick={() => removeFile(file.id)}>×</button>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        {files.length > 0 && (
          <div className="button-container">
            <button onClick={generatePdf} disabled={isConverting} className="button convert-btn">
              {isConverting ? 'Converting...' : 'Convert to PDF'}
            </button>

            {pdfBlob && (
              <a href={URL.createObjectURL(pdfBlob)} download="converted.pdf" className="button download-btn">
                Download PDF
              </a>
            )}

            <button onClick={clearAllFiles} className="button clear-btn">
              Clear All
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
