import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { cn } from "../../lib/cn";

interface TypewriterProps {
  text: string | string[];
  speed?: number;
  deleteSpeed?: number;
  waitTime?: number;
  loop?: boolean;
  className?: string;
  cursorChar?: string;
}

export function Typewriter({
  text,
  speed = 60,
  deleteSpeed = 35,
  waitTime = 2000,
  loop = true,
  className,
  cursorChar = "_",
}: TypewriterProps) {
  const [displayText, setDisplayText] = useState("");
  const [charIndex, setCharIndex] = useState(0);
  const [textIndex, setTextIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  const texts = Array.isArray(text) ? text : [text];

  useEffect(() => {
    const current = texts[textIndex];

    const timeout = setTimeout(
      () => {
        if (isDeleting) {
          if (displayText === "") {
            setIsDeleting(false);
            if (textIndex === texts.length - 1 && !loop) return;
            setTextIndex((prev) => (prev + 1) % texts.length);
            setCharIndex(0);
          } else {
            setDisplayText((prev) => prev.slice(0, -1));
          }
        } else {
          if (charIndex < current.length) {
            setDisplayText((prev) => prev + current[charIndex]);
            setCharIndex((prev) => prev + 1);
          } else if (texts.length > 1) {
            setTimeout(() => setIsDeleting(true), waitTime);
          }
        }
      },
      isDeleting ? deleteSpeed : speed,
    );

    return () => clearTimeout(timeout);
  }, [charIndex, displayText, isDeleting, speed, deleteSpeed, waitTime, texts, textIndex, loop]);

  return (
    <span className={cn("inline", className)}>
      {displayText}
      <motion.span
        className="ml-0.5"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{
          duration: 0.01,
          repeat: Infinity,
          repeatDelay: 0.4,
          repeatType: "reverse",
        }}
      >
        {cursorChar}
      </motion.span>
    </span>
  );
}
