import { Link } from "wouter";
import { Home, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <Home className="w-8 h-8 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-4xl font-bold">404</h1>
            <h2 className="text-xl font-semibold mt-2">Page not found</h2>
            <p className="text-sm text-muted-foreground mt-2">
              The page you're looking for doesn't exist or has been moved.
            </p>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => window.history.back()}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </Button>
            <Link href="/split-periods">
              <Button>
                <Home className="w-4 h-4 mr-2" />
                Go Home
              </Button>
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
