import { useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { PDFViewer } from "@/components/PDFViewer";
import { BookOpen, FileText, Sparkles } from "lucide-react";

export default function LibraryPage() {
  const books = [
    {
      title: "Tilt-Up Spread",
      description: "Guía completa y detallada sobre las mejores prácticas, técnicas y normativas para la construcción eficiente mediante paneles de hormigón Tilt-Up.",
      fileName: "Tilt Up-Spread-V1.pdf",
      icon: <BookOpen className="w-20 h-20 text-amber-700 mb-6 group-hover:text-amber-600 transition-colors" strokeWidth={1.5} />,
      color: "from-amber-50 to-orange-50",
      borderColor: "border-amber-200/50",
      accent: "bg-amber-600/20",
      textColor: "text-amber-900",
      btnColor: "bg-amber-600 hover:bg-amber-500",
    }
  ];

  const [selectedBook, setSelectedBook] = useState<(typeof books)[number] | null>(books[0]);

  const selectedPdfUrl = useMemo(() => {
    if (!selectedBook) return "";
    const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
    const libraryPath = `${basePath}/uploads/biblioteca`;
    return `${libraryPath}/${selectedBook.fileName}`;
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
          <div className="flex flex-col md:flex-row justify-center items-stretch gap-10 w-full max-w-5xl">
            {books.map((book, index) => (
              <div
                key={index}
                className={`flex-1 flex flex-col bg-gradient-to-br ${book.color} backdrop-blur-sm rounded-xl border-2 ${book.borderColor} shadow-2xl overflow-hidden relative group hover:-translate-y-2 transition-transform duration-300`}
              >
                {/* Lomo del libro simulado */}
                <div className={`absolute left-0 top-0 bottom-0 w-8 border-r-2 border-black/5 ${book.accent} shadow-inner z-10 flex flex-col justify-center items-center py-4`}>
                  <div className="w-px h-full bg-black/5 rounded-full"></div>
                </div>

                <div className="pl-14 pr-10 py-12 flex-1 flex flex-col items-center text-center relative z-0">
                  <div className="transform group-hover:scale-110 transition-transform duration-500">
                    {book.icon}
                  </div>

                  <h3 className={`text-3xl font-bold ${book.textColor} font-serif mb-6 leading-tight`}>
                    {book.title}
                  </h3>

                  <p className="text-gray-700 text-base leading-relaxed mb-10 flex-1">
                    {book.description}
                  </p>

                  <button
                    onClick={() => setSelectedBook(book)}
                    className={`w-full py-4 px-6 rounded-lg font-bold text-white shadow-lg transition-all active:scale-95 flex items-center justify-center gap-3 ${book.btnColor}`}
                  >
                    <Sparkles className="w-6 h-6" />
                    Ver en visor seguro
                  </button>
                </div>
              </div>
            ))}
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
