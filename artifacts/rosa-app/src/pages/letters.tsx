import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Plus, Lock, X, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { format, addMonths, isPast, parseISO } from "date-fns";
import { useToast } from "@/hooks/use-toast";

type Letter = {
  id: string;
  createdAt: string;
  deliveryDate: string;
  content: string;
  opened: boolean;
  months: 3 | 6 | 12;
};

export default function LettersPage() {
  const [letters, setLetters] = useLocalStorage<Letter[]>("rosa_letters", []);
  const [writing, setWriting] = useState(false);
  const [form, setForm] = useState({ content: "", months: 3 as 3 | 6 | 12 });
  const [openedLetter, setOpenedLetter] = useState<Letter | null>(null);
  const { toast } = useToast();

  const saveLetter = () => {
    if (!form.content.trim()) return;
    const letter: Letter = {
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      deliveryDate: addMonths(new Date(), form.months).toISOString(),
      content: form.content,
      opened: false,
      months: form.months,
    };
    setLetters([...letters, letter]);
    setForm({ content: "", months: 3 });
    setWriting(false);
    toast({ title: `Letter sealed 💌 Opens in ${form.months} months` });
  };

  const openLetter = (letter: Letter) => {
    if (!isPast(parseISO(letter.deliveryDate))) {
      toast({ title: "Not ready yet! 💌", description: `Opens on ${format(parseISO(letter.deliveryDate), "MMMM do, yyyy")}` });
      return;
    }
    setLetters(letters.map((l) => l.id === letter.id ? { ...l, opened: true } : l));
    setOpenedLetter({ ...letter, opened: true });
  };

  return (
    <div className="min-h-full p-4 md:p-8 space-y-6 max-w-2xl pb-24">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-serif text-foreground flex items-center gap-2">
              <Mail className="w-7 h-7 text-primary" /> Letters to Future Me
            </h1>
            <p className="text-muted-foreground mt-1">Write a letter. Open it months from now.</p>
          </div>
          <Button onClick={() => setWriting(true)} className="bg-primary hover:bg-primary/90 gap-2">
            <Plus className="w-4 h-4" /> Write
          </Button>
        </div>
      </motion.div>

      {/* Writing Modal */}
      <AnimatePresence>
        {writing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center p-4"
          >
            <motion.div
              initial={{ y: 60 }}
              animate={{ y: 0 }}
              exit={{ y: 60 }}
              className="bg-card w-full max-w-lg rounded-3xl p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto"
              style={{ background: "linear-gradient(135deg, #fff5f7 0%, #fff 100%)" }}
            >
              <div className="flex justify-between items-center">
                <h2 className="font-serif text-xl">Dear Future Me,</h2>
                <button onClick={() => setWriting(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
              </div>
              <p className="text-xs text-muted-foreground italic">Write freely. This letter is sealed until your chosen date.</p>

              <Textarea
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                placeholder="Right now, I am feeling... In a few months, I hope... What I want you to remember is..."
                className="min-h-[200px] resize-none border-rose-200 focus:border-rose-400 text-base leading-relaxed bg-transparent"
                autoFocus
              />

              <div>
                <p className="text-sm font-medium mb-3">When should future you open this?</p>
                <div className="grid grid-cols-3 gap-3">
                  {([3, 6, 12] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setForm((f) => ({ ...f, months: m }))}
                      className={`p-3 rounded-2xl border text-center transition-all ${form.months === m ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary"}`}
                    >
                      <p className="font-bold text-lg">{m}</p>
                      <p className="text-xs">months</p>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Opens: {format(addMonths(new Date(), form.months), "MMMM do, yyyy")}
                </p>
              </div>

              <div className="flex gap-3">
                <Button onClick={saveLetter} className="flex-1 bg-primary hover:bg-primary/90">Seal & Send 💌</Button>
                <Button variant="outline" onClick={() => setWriting(false)}>Cancel</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Open Letter View */}
      <AnimatePresence>
        {openedLetter && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-card w-full max-w-lg rounded-3xl p-8 shadow-2xl max-h-[85vh] overflow-y-auto"
              style={{ background: "linear-gradient(135deg, #fff5f7 0%, #fff9fa 100%)" }}
            >
              <div className="text-center mb-6">
                <Heart className="w-10 h-10 text-primary mx-auto mb-2" />
                <h2 className="font-serif text-2xl text-primary">A letter from your past self 💌</h2>
                <p className="text-xs text-muted-foreground mt-1">Written {format(parseISO(openedLetter.createdAt), "MMMM do, yyyy")}</p>
              </div>
              <div className="font-serif text-base leading-relaxed text-foreground/80 whitespace-pre-wrap mb-6 border-l-4 border-primary/30 pl-4">
                Dear Future Me,<br /><br />
                {openedLetter.content}
              </div>
              <div className="text-right">
                <p className="font-serif text-sm text-muted-foreground italic">With love, Past You 🌹</p>
              </div>
              <Button onClick={() => setOpenedLetter(null)} className="w-full mt-6 bg-primary hover:bg-primary/90">Close Letter</Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {letters.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Mail className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="font-serif text-lg">No letters sealed yet.</p>
          <p className="text-sm mt-1">Write a letter to your future self. She'll thank you.</p>
        </div>
      )}

      <div className="space-y-4">
        {letters.map((letter) => {
          const ready = isPast(parseISO(letter.deliveryDate));
          return (
            <motion.div key={letter.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card
                className={`cursor-pointer hover:shadow-md transition-all ${ready ? "border-primary/50 bg-rose-50/40" : "border-border/50"} ${letter.opened ? "opacity-70" : ""}`}
                onClick={() => openLetter(letter)}
              >
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${ready ? "bg-primary/20" : "bg-muted"}`}>
                        {ready ? <Mail className="w-5 h-5 text-primary" /> : <Lock className="w-5 h-5 text-muted-foreground" />}
                      </div>
                      <div>
                        <p className="font-medium text-sm">Letter to future me</p>
                        <p className="text-xs text-muted-foreground">Written {format(parseISO(letter.createdAt), "MMM do, yyyy")}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      {letter.opened ? (
                        <Badge variant="secondary" className="text-xs">Opened 💌</Badge>
                      ) : ready ? (
                        <Badge className="bg-primary text-primary-foreground text-xs">Ready to open!</Badge>
                      ) : (
                        <div>
                          <p className="text-xs text-muted-foreground">Opens</p>
                          <p className="text-xs font-medium">{format(parseISO(letter.deliveryDate), "MMM do, yyyy")}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
