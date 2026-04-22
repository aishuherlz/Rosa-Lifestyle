import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, Send, Heart, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const DEVELOPER_EMAIL = "aiswarysaji2601@gmail.com";

export default function SupportPage() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [sent, setSent] = useState(false);

  const handleSubmit = () => {
    if (!form.name || !form.email || !form.message) return;
    const subject = encodeURIComponent(`ROSA App Support — from ${form.name}`);
    const body = encodeURIComponent(`Name: ${form.name}\nEmail: ${form.email}\n\nMessage:\n${form.message}`);
    window.location.href = `mailto:${DEVELOPER_EMAIL}?subject=${subject}&body=${body}`;
    setSent(true);
  };

  return (
    <div className="min-h-full p-4 md:p-8 space-y-6 max-w-2xl">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-serif text-foreground">Support</h1>
        <p className="text-muted-foreground mt-1">We're here for you.</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}>
        <Card className="border-rose-200 bg-gradient-to-br from-rose-50 to-pink-50 shadow-sm">
          <CardContent className="pt-6 text-center">
            <Heart className="w-10 h-10 text-rose-400 mx-auto mb-3" />
            <p className="font-serif text-xl text-foreground mb-2">Made with love, for you</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              ROSA was built by a woman, for women. Every feature was crafted with care. 
              If you have a question, a suggestion, or just want to say hello — reach out directly.
            </p>
            <div className="mt-4 flex items-center justify-center gap-2 text-primary font-medium">
              <Mail className="w-4 h-4" />
              <a href={`mailto:${DEVELOPER_EMAIL}`} className="hover:underline" data-testid="link-developer-email">
                {DEVELOPER_EMAIL}
              </a>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {!sent ? (
        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle className="font-serif text-lg flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" /> Send a Message
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Your Name</Label>
              <Input placeholder="e.g. Aria" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} data-testid="input-support-name" />
            </div>
            <div>
              <Label>Your Email</Label>
              <Input type="email" placeholder="hello@example.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} data-testid="input-support-email" />
            </div>
            <div>
              <Label>Message</Label>
              <Textarea
                placeholder="Share your thoughts, report a bug, or just say hi..."
                value={form.message}
                onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                className="resize-none min-h-[120px]"
                data-testid="textarea-support-message"
              />
            </div>
            <Button
              onClick={handleSubmit}
              disabled={!form.name || !form.email || !form.message}
              className="w-full bg-primary hover:bg-primary/90"
              data-testid="button-send-support"
            >
              <Send className="w-4 h-4 mr-2" /> Send Message
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              This will open your email app pre-filled with your message.
            </p>
          </CardContent>
        </Card>
      ) : (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
          <Card className="border-emerald-200 bg-emerald-50 shadow-sm text-center py-8">
            <CardContent>
              <div className="text-4xl mb-3">💌</div>
              <h3 className="font-serif text-xl mb-2">Message sent!</h3>
              <p className="text-muted-foreground text-sm">Thank you for reaching out. Your email app should have opened.</p>
              <Button variant="outline" className="mt-4" onClick={() => setSent(false)} data-testid="button-send-another">Send Another</Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <Card className="border-border/50 shadow-sm">
        <CardContent className="pt-5">
          <h3 className="font-semibold text-sm mb-3">Quick Help</h3>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p><span className="font-medium text-foreground">Data is stored locally</span> — your data stays on your device. No account required.</p>
            <p><span className="font-medium text-foreground">Period tracker</span> — log your cycle start date and we'll predict the rest.</p>
            <p><span className="font-medium text-foreground">Partner sharing</span> — share your unique code and enter your partner's code to connect.</p>
            <p><span className="font-medium text-foreground">Notifications</span> — enable browser notifications on the Quotes page for daily inspiration.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
