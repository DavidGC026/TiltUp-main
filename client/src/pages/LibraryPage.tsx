import { useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { PDFViewer } from "@/components/PDFViewer";
import { Card } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

interface Book {
  id: string;
  title: string;
  description: string;
  fileName: string;
  pdfFolder: string;
  cover: string; // path relative to public (e.g., /IM-Cover-tiltup-web.jpg)
}

export default function LibraryPage() {
  const books: Book[] = [
    {
      id: "tiltup-spread",
      title: "Tilt-Up Spread",
      description:
        "Guía completa y detallada sobre las mejores prácticas, técnicas y normativas para la construcción eficiente mediante paneles de hormigón Tilt-Up.",
      fileName: "Tilt Up-Spread-V1.pdf",
      pdfFolder: "biblioteca",
      cover: "/IM-Cover-tiltup-web.jpg",
    },
    {
      id: "bitacora-control",
      title: "Bitácora de Control",
      description: "Formato de bitácora para el control y seguimiento de obra, listo para utilizar en campo.",
      fileName: "Bitacora.pdf",
      pdfFolder: "bitacoras",
      cover: "/IM-Cover-bitacora-web.jpg",
    },
  ];

  const [selectedBook, setSelectedBook] = useState<(typeof books)[number] | null>(books[0]);

  const selectedPdfUrl = useMemo(() => {
    if (!selectedBook) return "";
    const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
    const folderPath = `${basePath}/uploads/${selectedBook.pdfFolder}`;
    return `${folderPath}/${selectedBook.fileName}`;
  }, [selectedBook]);

  return (
    <div className="min-h-screen bg-transparent">
      {/* Content wrapper */}
      <div className="relative z-10">
        <Header />

        <main className="w-full px-4 sm:px-6 lg:px-8 py-16 flex flex-col items-center">
          <div className="mb-16 text-center max-w-3xl">
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6 drop-shadow-md">
              BIBLIOTECA
            </h2>
            <p className="text-lg text-white/90 drop-shadow-sm font-medium leading-relaxed">
              Consulta nuestra colección de libros técnicos y manuales especializados para complementar tu aprendizaje. Selecciona el material que desees visualizar en el visor seguro sin opción de descarga o impresión.
            </p>
          </div>

          {/* Contenedor principal de los libros */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-5xl">
            {books.map((book) => {
              const isSelected = selectedBook?.id === book.id;
              const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
              const coverSrc = `${basePath}${book.cover.startsWith("/") ? book.cover : `/${book.cover}`}`;

              return (
                <Card
                  key={book.id}
                  className={`overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${isSelected ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
                    }`}
                  onClick={() => setSelectedBook(book)}
                  data-testid={`library-card-${book.id}`}
                >
                  <div className="relative aspect-[3/4] w-full overflow-hidden">
                    <img
                      src={coverSrc}
                      alt={book.title}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/25 to-transparent" />
                    <div className="absolute bottom-4 left-4 right-4 text-white drop-shadow">
                      <p className="text-xs uppercase tracking-wide opacity-80">Libro</p>
                      <h3 className="text-2xl font-bold leading-tight">{book.title}</h3>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Visor PDF sin descarga ni impresión */}
          {selectedBook && (
            <div className="w-full max-w-6xl mt-14">
              <div className="flex items-center gap-3 mb-4 text-white drop-shadow-md">
                <Sparkles className="w-5 h-5" />
                <div>
                  <p className="text-sm uppercase tracking-wide opacity-80">Visor de archivo</p>
                  <h3 className="text-2xl font-bold">{selectedBook.title}</h3>
                  <p className="text-xs opacity-80">Descarga e impresión deshabilitadas; visualización sólo dentro de la plataforma.</p>
                </div>
              </div>
              <PDFViewer pdfUrl={selectedPdfUrl} title={selectedBook.title} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
