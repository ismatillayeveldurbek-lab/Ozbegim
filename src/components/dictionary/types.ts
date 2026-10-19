export interface SourceInfo {
  title: string;
  author: string | null;
  url: string | null;
  year: number | null;
}
export interface IdiomDTO {
  id: string;
  phrase: string;
  status: string;
  origin: string;
  tags: string[];
  source: SourceInfo | null;
  senses: Array<{ id: string; meaning: string; example: string | null; synonyms: string[] }>;
}
export interface LoanwordDTO {
  id: string;
  word: string;
  meaning: string | null;
  domain: string | null;
  originLanguage: string | null;
  spellingVariants: string[];
  status: string;
  origin: string;
  tags: string[];
  source: SourceInfo | null;
  alternatives: Array<{ text: string; usageNote: string | null }>;
  examples: string[];
}
export interface CommentDTO {
  id: string;
  proposal: string;
  explanation: string;
  example: string | null;
  sourceUrl: string | null;
  status: string;
  score: number;
  createdAt: string;
  author: string;
  mine: boolean;
  myVote: number;
}
export interface DiscussionDTO {
  discussion: { id: string; key: string; displayTerm: string } | null;
  comments: CommentDTO[];
}
