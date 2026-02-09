import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast relative pl-12 group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-slate-900/20 group-[.toaster]:shadow-[0_0_0_1px_rgba(15,23,42,0.5),0_0_16px_rgba(15,23,42,0.25)] dark:group-[.toaster]:border-[#d9f56b]/40 dark:group-[.toaster]:shadow-[0_0_0_1px_#d9f56b,0_0_16px_rgba(217,245,107,0.35)] before:absolute before:left-3 before:top-1/2 before:-translate-y-1/2 before:h-6 before:w-6 before:rounded-full before:bg-slate-900 before:text-white dark:before:bg-[#d9f56b] dark:before:text-black before:content-['!'] before:text-xs before:font-bold before:grid before:place-items-center",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
