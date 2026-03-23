import { useQuery } from "@tanstack/react-query";
import { ModuleCard } from "@/components/ModuleCard";
import { Header } from "@/components/Header";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ProgressBar";
import { Link } from "wouter";
import { BookOpen } from "lucide-react";
import type { Module } from "@shared/schema";

export default function Home() {
  const { data: modules, isLoading } = useQuery<Module[]>({
    queryKey: ["/api/modules"],
  });

  const libraryCard = (
    <div
      key="library"
      className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-white/20 h-full md:col-start-1 md:row-start-2 lg:col-start-1 lg:row-start-2"
    >
      <Link href="/biblioteca">
        <Card className="overflow-hidden transition-all duration-300 h-full hover-elevate active-elevate-2 cursor-pointer hover:shadow-lg" data-testid="card-library">
          <div className="flex flex-col h-full">
            <div className="relative w-full shrink-0 aspect-video overflow-hidden bg-muted">
              <img
                src="/IM-Cover-tiltup-web.jpg"
                alt="Biblioteca técnica"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/25 to-transparent" />

              <div className="absolute top-4 left-4">
                <Badge variant="secondary" className="bg-primary text-primary-foreground font-bold px-3 py-1.5 text-sm">
                  MÓDULO BIBLIOTECA
                </Badge>
              </div>
            </div>

            <div className="p-6 flex flex-col justify-between flex-grow">
              <div>
                <h3 className="text-2xl font-bold text-foreground mb-0">Biblioteca técnica</h3>
              </div>

              <div className="mt-auto pt-4 border-t border-border/50">
                <ProgressBar progress={100} className="h-3" />
              </div>
            </div>
          </div>
        </Card>
      </Link>
    </div>
  );

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
              {(modules || []).flatMap((module, index) => {
                const items = [
                  <div key={module.id} className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-white/20 h-full">
                    <ModuleCard module={module} />
                  </div>,
                ];

                if (index === 0) {
                  items.push(libraryCard);
                }

                return items;
              })}
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
