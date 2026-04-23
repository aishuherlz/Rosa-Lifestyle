import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, ExternalLink, Trash2, Gift, Star, ShoppingBag, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocalStorage } from "@/hooks/use-local-storage";

type WishlistItem = {
  id: string;
  title: string;
  link: string;
  price: string;
  store: string;
  priority: "low" | "medium" | "high";
  addedAt: string;
};

const GIFT_QUIZ = [
  { question: "What's her favourite type of activity?", options: ["Relaxing at home", "Going out & adventures", "Creative hobbies", "Sports & fitness"] },
  { question: "What's her current favourite aesthetic?", options: ["Cozy & comfort", "Glamorous & chic", "Minimal & clean", "Bohemian & free"] },
  { question: "What does she value most?", options: ["Experiences & memories", "Practical useful items", "Luxury treats", "Handmade & personal"] },
];

const QUIZ_ANSWERS: Record<string, string> = {
  "Relaxing at home-Cozy & comfort-Experiences & memories": "A spa day voucher or luxurious bath set she'll absolutely adore.",
  "Going out & adventures-Glamorous & chic-Experiences & memories": "A dinner at a fancy restaurant or a weekend getaway package.",
  "Creative hobbies-Bohemian & free-Handmade & personal": "An art supply kit or a personalised keepsake like a custom portrait.",
  default: "A beautifully curated gift set from her favourite brand — or a heartfelt handwritten letter with a meaningful experience.",
};

const PRIORITY_COLORS = { low: "bg-slate-100 text-slate-700", medium: "bg-amber-100 text-amber-700", high: "bg-rose-100 text-rose-700" };

export default function WishlistPage() {
  const [items, setItems] = useLocalStorage<WishlistItem[]>("rosa_wishlist", []);
  const [open, setOpen] = useState(false);
  const [quizOpen, setQuizOpen] = useState(false);
  const [quizStep, setQuizStep] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<string[]>([]);
  const [quizResult, setQuizResult] = useState("");
  const [form, setForm] = useState({ title: "", link: "", price: "", store: "", priority: "medium" as "low" | "medium" | "high" });

  const handleAdd = () => {
    const item: WishlistItem = { id: Date.now().toString(), ...form, addedAt: new Date().toISOString() };
    setItems([...items, item]);
    setOpen(false);
    setForm({ title: "", link: "", price: "", store: "", priority: "medium" });
  };

  const handleDelete = (id: string) => setItems(items.filter(i => i.id !== id));

  const handleQuizAnswer = (answer: string) => {
    const next = [...quizAnswers, answer];
    setQuizAnswers(next);
    if (quizStep < GIFT_QUIZ.length - 1) {
      setQuizStep(s => s + 1);
    } else {
      const key = next.join("-");
      setQuizResult(QUIZ_ANSWERS[key] || QUIZ_ANSWERS.default);
    }
  };

  const resetQuiz = () => { setQuizStep(0); setQuizAnswers([]); setQuizResult(""); };

  return (
    <div className="min-h-full p-4 md:p-8 space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-serif text-foreground">Wishlist</h1>
            <p className="text-muted-foreground mt-1">Things that make your heart sing.</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={quizOpen} onOpenChange={v => { setQuizOpen(v); if (!v) resetQuiz(); }}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" data-testid="button-open-quiz">
                  <HelpCircle className="w-4 h-4 mr-1" /> Gift Quiz
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle className="font-serif text-xl">Find the Perfect Gift</DialogTitle></DialogHeader>
                {!quizResult ? (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">Question {quizStep + 1} of {GIFT_QUIZ.length}</p>
                    <p className="font-medium">{GIFT_QUIZ[quizStep].question}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {GIFT_QUIZ[quizStep].options.map(opt => (
                        <button key={opt} onClick={() => handleQuizAnswer(opt)} className="p-3 text-sm border border-border rounded-xl hover:bg-primary/5 hover:border-primary transition-all text-left" data-testid={`quiz-option-${opt.slice(0, 10)}`}>
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-5 bg-rose-50 border border-rose-200 rounded-2xl text-center">
                      <Gift className="w-10 h-10 text-rose-400 mx-auto mb-2" />
                      <p className="font-serif text-lg font-medium mb-2">Our Recommendation</p>
                      <p className="text-sm text-muted-foreground">{quizResult}</p>
                    </div>
                    <Button variant="outline" onClick={resetQuiz} className="w-full">Take Quiz Again</Button>
                  </div>
                )}
              </DialogContent>
            </Dialog>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary hover:bg-primary/90" data-testid="button-add-wish">
                  <Plus className="w-4 h-4 mr-1" /> Add Item
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle className="font-serif text-xl">Add to Wishlist</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Item Name</Label>
                    <Input placeholder="e.g. Silk pillowcase" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} data-testid="input-wish-title" />
                  </div>
                  <div>
                    <Label>Link (optional)</Label>
                    <Input placeholder="https://..." value={form.link} onChange={e => setForm(f => ({ ...f, link: e.target.value }))} data-testid="input-wish-link" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Price (optional)</Label>
                      <Input placeholder="€49.99" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Store</Label>
                      <Input placeholder="e.g. Zara" value={form.store} onChange={e => setForm(f => ({ ...f, store: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <Label>Priority</Label>
                    <Select value={form.priority} onValueChange={(v: any) => setForm(f => ({ ...f, priority: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Nice to have</SelectItem>
                        <SelectItem value="medium">Would love it</SelectItem>
                        <SelectItem value="high">Dream item</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleAdd} disabled={!form.title} className="w-full bg-primary" data-testid="button-save-wish">Add to Wishlist</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </motion.div>

      {items.length === 0 ? (
        <Card className="border-dashed border-2 border-border text-center py-16">
          <CardContent>
            <ShoppingBag className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground text-lg font-serif">Your wishlist is empty</p>
            <p className="text-muted-foreground text-sm mt-1">Add items you'd love — or try the Gift Quiz!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence>
            {items.map((item, i) => (
              <motion.div key={item.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ delay: i * 0.05 }} data-testid={`card-wish-${item.id}`}>
                <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow h-full">
                  <CardContent className="pt-5 flex flex-col h-full">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <h3 className="font-semibold text-base">{item.title}</h3>
                      <button onClick={() => handleDelete(item.id)} className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0" data-testid={`button-delete-wish-${item.id}`}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-3">
                      <Badge className={PRIORITY_COLORS[item.priority]}>
                        <Star className="w-3 h-3 mr-1" />
                        {item.priority === "high" ? "Dream item" : item.priority === "medium" ? "Would love it" : "Nice to have"}
                      </Badge>
                      {item.store && <Badge variant="outline">{item.store}</Badge>}
                    </div>
                    <div className="mt-auto flex items-center justify-between">
                      {item.price && <span className="text-primary font-semibold">{item.price}</span>}
                      {item.link && (
                        <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors" data-testid={`link-wish-${item.id}`}>
                          <ExternalLink className="w-3 h-3" /> View item
                        </a>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
