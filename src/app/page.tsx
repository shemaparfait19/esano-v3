import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dna, Bot, Users, Globe, BarChart, Sparkles } from "lucide-react";
import { Logo } from "@/components/logo";

const features = [
  {
    icon: <Dna className="h-8 w-8 text-primary" />,
    title: "AI-Powered DNA Analysis",
    description:
      "Upload your DNA data and let our AI uncover your roots, connect you with relatives, and reveal generational insights.",
  },
  {
    icon: <Users className="h-8 w-8 text-primary" />,
    title: "Find & Connect Relatives",
    description:
      "Discover potential relatives through our advanced matching algorithm and build your family network.",
  },
  {
    icon: <Globe className="h-8 w-8 text-primary" />,
    title: "Detailed Ancestry Reports",
    description:
      "Explore your ethnic origins with interactive maps and detailed percentage breakdowns.",
  },
  {
    icon: <Sparkles className="h-8 w-8 text-primary" />,
    title: "Generational Insights",
    description:
      "Learn about traits and heritage passed down through your family line, all derived from your genetic data.",
  },
  {
    icon: <Bot className="h-8 w-8 text-primary" />,
    title: "Genealogy Assistant",
    description:
      "Our AI chatbot is ready to answer your questions about genealogy, DNA, and your family history.",
  },
  {
    icon: <BarChart className="h-8 w-8 text-primary" />,
    title: "Interactive Visualizations",
    description:
      "Engage with your data through beautiful charts and visualizations that bring your story to life.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center">
          <div className="mr-4 flex">
            <Link href="/" className="mr-6 flex items-center">
              <Logo className="h-10 w-28" />
            </Link>
          </div>
          <div className="flex flex-1 items-center justify-end space-x-2">
            <nav className="hidden md:flex items-center gap-6 mr-4 text-sm text-muted-foreground">
              <Link href="/dashboard/relatives">Relatives</Link>
              <Link href="/dashboard/family-tree">Family Tree</Link>
              <Link href="/dashboard/dna-analysis">DNA Analysis</Link>
              <Link href="/dashboard/insights">Insights</Link>
              <Link
                href="/counseling"
                className="text-foreground hover:text-primary transition-colors"
              >
                Counseling
              </Link>
            </nav>
            <Button variant="ghost" asChild>
              <Link href="/login">Log In</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero with background image */}
        <section className="relative py-24 md:py-40">
          <Image
            src="/assets/hero.png"
            alt="Hero background"
            fill
            priority
            className="object-cover -z-10"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/70 to-background" />
          <div className="container text-center relative">
            <h1 className="font-headline text-4xl font-bold tracking-tight text-primary md:text-6xl lg:text-7xl">
              Discover Your Story
            </h1>
            <p className="mt-4 text-lg text-foreground/80 md:text-xl max-w-2xl mx-auto">
              Esano is your personal genealogy explorer. Uncover your ancestry,
              connect with family, and understand your heritage through the
              power of AI.
            </p>
            <div className="mt-8 flex justify-center gap-4">
              <Button size="lg" className="shadow-md shadow-black/10" asChild>
                <Link href="/signup">Explore Your DNA</Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="shadow-md shadow-black/10"
              >
                Learn More
              </Button>
            </div>
          </div>
        </section>

        <section className="bg-background/70 py-20 md:py-24">
          <div className="container">
            <div className="relative">
              <Image
                src="/assets/afterhero.png"
                alt="Family tree visualization"
                data-ai-hint="family tree"
                width={1200}
                height={500}
                className="object-cover w-full h-auto aspect-[12/5] shadow-2xl shadow-primary/10"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
              <div className="absolute inset-0 flex items-end p-6 md:p-10">
                <div className="max-w-2xl">
                  <h3 className="font-headline text-2xl md:text-3xl font-bold text-primary">
                    Build and Explore Your Family Tree
                  </h3>
                  <p className="mt-2 text-foreground/80">
                    Visualize generations, add relatives, and trace connections
                    across Rwanda and beyond.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-20 md:py-32">
          <div className="container">
            <div className="text-center max-w-3xl mx-auto">
              <h2 className="font-headline text-3xl font-bold text-primary md:text-4xl">
                A New Era of Genealogy
              </h2>
              <p className="mt-4 text-lg text-foreground/80">
                Our platform combines cutting-edge AI with a user-friendly
                design to provide you with an unparalleled experience in
                exploring your family history.
              </p>
            </div>

            <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <Card
                  key={feature.title}
                  className="bg-card/80 hover:shadow-lg transition-shadow"
                >
                  <CardHeader className="flex flex-row items-center gap-4">
                    {feature.icon}
                    <CardTitle className="font-headline text-xl text-primary">
                      {feature.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-foreground/70">{feature.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Video section with YouTube thumbnail */}
        <section className="py-16 md:py-24">
          <div className="container">
            <div className="text-center max-w-3xl mx-auto">
              <h2 className="font-headline text-3xl font-bold text-primary md:text-4xl">
                How to use the system
              </h2>
              <p className="mt-3 text-foreground/80">
                Watch a quick walkthrough to get started with Esano.
              </p>
            </div>
            <div className="mt-8 mx-auto max-w-4xl">
              <Link
                href="https://www.youtube.com/watch?v=fkGCLIQx1MI&pp=ygURaG93IHRvIHVzZSBzeXN0ZW0%3D"
                target="_blank"
                rel="noopener noreferrer"
                className="group block relative"
              >
                <Image
                  src="/assets/youtubethumbnail.png"
                  alt="How to use the system - video thumbnail"
                  width={1280}
                  height={720}
                  className="w-full h-auto object-cover"
                />
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-16 w-16 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                    <svg
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="h-8 w-8 text-red-600"
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </section>

        <section className="bg-primary text-primary-foreground py-20 md:py-24">
          <div className="container text-center">
            <h2 className="font-headline text-3xl font-bold md:text-4xl">
              Ready to Start Your Journey?
            </h2>
            <p className="mt-4 text-lg opacity-90 max-w-2xl mx-auto">
              Your story is waiting to be told. Upload your DNA data today and
              let Esano guide you through your past.
            </p>
            <div className="mt-8">
              <Button
                size="lg"
                variant="secondary"
                className="bg-accent text-accent-foreground hover:bg-accent/90"
                asChild
              >
                <Link href="/signup">Upload Your DNA</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="container py-8 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Esano. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
