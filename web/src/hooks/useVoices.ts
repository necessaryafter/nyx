import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

export interface TalkifyVoice {
  id: string;
  name: string;
  gender: "man" | "women";
  previewUrl: string;
}

export function useVoices() {
  return useQuery({
    queryKey: ["talkify", "voices"],
    queryFn: () => api.get<TalkifyVoice[]>("/api/integrations/talkify/voices"),
    staleTime: 60 * 60 * 1000, // 1h — voices change rarely
  });
}
