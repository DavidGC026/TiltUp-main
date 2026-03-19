import { useQuery } from "@tanstack/react-query";
import { ModuleCard } from "@/components/ModuleCard";
import { Header } from "@/components/Header";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Link } from "wouter";
import { BookOpen } from "lucide-react";
import type { Module } from "@shared/schema";

export default function Home() {
  const { data: modules, isLoading } = useQuery<Module[]>({
    queryKey: ["/api/modules"],
  });

  return (
    <div className="min-h-screen bg-transparent">
      {/* Content wrapper */}
      <div className="relative z-10">
        <Header />

        <main className="w-full px-4 sm:px-6 lg:px-8 py-12">
          <div className="mb-12 text-center">
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4 drop-shadow-md" data-testid="text-page-title">
              CONSTRUCCIÓN DE TILT-UP
            </h2>
            <p className="text-lg text-white/90 max-w-3xl mx-auto drop-shadow-sm font-medium">
              Aprende las técnicas profesionales de construcción Tilt-Up a través de nuestros módulos educativos interactivos.
              Desde la planificación hasta el acabado final.
            </p>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i} className="overflow-hidden bg-white/95 backdrop-blur-sm border-white/20" data-testid={`card-skeleton-${i}`}>
                  <Skeleton className="aspect-video w-full" />
                  <div className="p-6 space-y-4">
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                    <Skeleton className="h-2 w-full mt-4" />
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
              data-testid="grid-modules"
            >
              {modules?.map((module) => (
                <div key={module.id} className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-white/20 h-full">
                  <ModuleCard module={module} />
                </div>
              ))}

              {/* Módulo extra para la Biblioteca */}
              <div className="md:col-span-2 lg:col-span-2 md:col-start-2 lg:col-start-2 mt-4">
                <Link href="/biblioteca">
                  <div className="bg-gradient-to-r from-amber-50 to-orange-50 backdrop-blur-sm rounded-lg shadow-lg border-2 border-amber-200/50 h-full min-h-[220px] flex flex-col items-center justify-center p-6 hover:scale-[1.02] hover:shadow-xl transition-all duration-300 group cursor-pointer text-center gap-4 relative overflow-hidden">
                    {/* Decoración estilo libro */}
                    <div className="absolute left-0 top-0 bottom-0 w-3 border-r-2 border-black/5 bg-amber-600/20 shadow-inner"></div>
                    
                    <BookOpen className="w-20 h-20 text-amber-700 opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300" strokeWidth={1.5} />
                    <h3 className="text-3xl font-bold text-amber-900 drop-shadow-sm font-serif">Ver Biblioteca</h3>
                  </div>
                </Link>
              </div>
            </div>
          )}

          {!isLoading && (!modules || modules.length === 0) && (
            <div className="text-center py-16 bg-white/10 rounded-xl backdrop-blur-md border border-white/20">
              <p className="text-white text-lg font-medium">
                No hay módulos disponibles en este momento.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
