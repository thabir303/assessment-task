export type MessageAuthor = "user" | "assistant";

export interface ChatMessage {
  id: string;
  sequence: number;
  author: MessageAuthor;
  content: string;
  isPartial: boolean;
}
