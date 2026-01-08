import { Moon, Sun, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTheme } from "@/providers/ThemeProvider"

interface ModeToggleProps {
  className?: string;
}

export function ModeToggle({ className }: ModeToggleProps) {
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    // Cycle through: light -> dark -> starwars -> light
    if (theme === "light") {
      setTheme("dark")
    } else if (theme === "dark") {
      setTheme("starwars")
    } else {
      setTheme("light")
    }
  }

  const getThemeIcon = () => {
    if (theme === "dark") {
      return <Moon className="h-[0.9rem] w-[0.9rem] rotate-0 scale-100 transition-all" />
    } else if (theme === "starwars") {
      return <Sparkles className="h-[0.9rem] w-[0.9rem] rotate-0 scale-100 transition-all" />
    } else {
      return <Sun className="h-[0.9rem] w-[0.9rem] rotate-0 scale-100 transition-all" />
    }
  }

  const getNextThemeName = () => {
    if (theme === "light") return "dark"
    if (theme === "dark") return "Star Wars"
    return "light"
  }

  return (
    <Button 
      variant="outline" 
      size="icon" 
      onClick={toggleTheme}
      className={`relative h-7 w-7 border-transparent hover:border-border hover:bg-accent hover:text-accent-foreground dark:hover:text-white starwars:hover:text-[#FFE81F] ${className}`}
      title={`Switch to ${getNextThemeName()} mode`}
    >
      {getThemeIcon()}
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}