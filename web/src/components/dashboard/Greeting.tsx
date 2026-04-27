function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

export function Greeting({ name }: { name: string }) {
  return (
    <h1 className="font-display text-2xl font-bold text-nyx-text-primary">
      {getGreeting()}, {name.split(" ")[0]}.
    </h1>
  );
}
