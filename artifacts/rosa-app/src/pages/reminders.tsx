import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, Bell, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { getPartnerOccasions, getUpcomingMilestones } from "@/lib/sync";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths } from "date-fns";
import { cn } from "@/lib/utils";

type Reminder = {
  id: string;
  date: string;
  title: string;
  type: string;
  time: string;
};

const REMINDER_TYPES = [
  { value: "bill", label: "Bill Payment" },
  { value: "birthday", label: "Birthday" },
  { value: "anniversary", label: "Anniversary" },
  { value: "assignment", label: "Assignment" },
  { value: "appointment", label: "Appointment" },
  { value: "subscription", label: "Subscription" },
  { value: "other", label: "Other" },
];

const TYPE_COLORS: Record<string, string> = {
  bill: "bg-amber-100 text-amber-700",
  birthday: "bg-rose-100 text-rose-700",
  anniversary: "bg-pink-100 text-pink-700",
  assignment: "bg-blue-100 text-blue-700",
  appointment: "bg-emerald-100 text-emerald-700",
  subscription: "bg-violet-100 text-violet-700",
  other: "bg-slate-100 text-slate-700",
};

export default function RemindersPage() {
  const [reminders, setReminders] = useLocalStorage<Reminder[]>("rosa_reminders", []);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(format(new Date(), "yyyy-MM-dd"));
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", type: "other", time: "" });

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  const dayReminders = reminders.filter(r => r.date === selectedDate);

  const handleSave = () => {
    if (!selectedDate || !form.title) return;
    const item: Reminder = { id: Date.now().toString(), date: selectedDate, ...form };
    setReminders([...reminders, item]);
    setOpen(false);
    setForm({ title: "", type: "other", time: "" });
  };

  const handleDelete = (id: string) => setReminders(reminders.filter(r => r.id !== id));

  const partnerOccasions = getPartnerOccasions(90).map(o => ({
    id: `partner-${o.kind}-${o.date}`,
    date: o.date,
    title: o.kind === "birthday" ? `${o.partnerName}'s Birthday 🎂` : `Anniversary with ${o.partnerName} 💐`,
    type: o.kind,
    time: "",
    isAuto: true as const,
  }));
  const milestoneReminders = getUpcomingMilestones(60).map(m => ({
    id: `milestone-${m.id}`,
    date: m.date,
    title: `🏆 ${m.title}`,
    type: "other",
    time: "",
    isAuto: true as const,
  }));
  const allUpcoming = [
    ...reminders.map(r => ({ ...r, isAuto: false as const })),
    ...partnerOccasions,
    ...milestoneReminders,
  ];
  const upcomingReminders = allUpcoming
    .filter(r => new Date(r.date) >= new Date())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 8);

  return (
    <div className="min-h-full p-4 md:p-8 space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-serif text-foreground">Reminders</h1>
        <p className="text-muted-foreground mt-1">Never forget what matters.</p>
      </motion.div>

      {/* Upcoming */}
      {upcomingReminders.length > 0 && (
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="font-serif text-lg flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" /> Coming Up
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcomingReminders.map(r => (
              <div key={r.id} className="flex items-center gap-3 py-2 border-b border-border/30 last:border-0">
                <Badge className={`text-xs ${TYPE_COLORS[r.type] || TYPE_COLORS.other}`}>
                  {REMINDER_TYPES.find(t => t.value === r.type)?.label || r.type}
                </Badge>
                <span className="font-medium text-sm flex-1">{r.title}</span>
                <span className="text-xs text-muted-foreground">{format(new Date(r.date + "T12:00:00"), "MMM d")}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Calendar */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="font-serif text-lg">Calendar</CardTitle>
            <div className="flex gap-2 items-center">
              <Button size="icon" variant="ghost" onClick={() => setCurrentMonth(m => subMonths(m, 1))}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm font-medium min-w-[100px] text-center">{format(currentMonth, "MMMM yyyy")}</span>
              <Button size="icon" variant="ghost" onClick={() => setCurrentMonth(m => addMonths(m, 1))}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1 text-center">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(d => (
              <div key={d} className="text-xs text-muted-foreground font-medium py-1">{d}</div>
            ))}
            {Array.from({ length: startOfMonth(currentMonth).getDay() }).map((_, i) => <div key={`e${i}`} />)}
            {days.map(day => {
              const dateStr = format(day, "yyyy-MM-dd");
              const hasReminders = reminders.some(r => r.date === dateStr);
              const isSelected = selectedDate === dateStr;
              const isToday = isSameDay(day, new Date());
              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDate(dateStr)}
                  className={cn(
                    "w-8 h-8 flex flex-col items-center justify-center text-sm mx-auto rounded-full transition-all relative",
                    isSelected && "bg-primary text-primary-foreground",
                    isToday && !isSelected && "ring-1 ring-primary font-semibold",
                    !isSelected && "hover:bg-muted"
                  )}
                  data-testid={`reminder-day-${dateStr}`}
                >
                  {format(day, "d")}
                  {hasReminders && <span className={cn("absolute bottom-0 w-1 h-1 rounded-full", isSelected ? "bg-white" : "bg-primary")} />}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Day panel */}
      {selectedDate && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="font-serif">{format(new Date(selectedDate + "T12:00:00"), "MMMM d, yyyy")}</CardTitle>
                <div className="flex gap-2">
                  <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="bg-primary" data-testid="button-add-reminder">
                        <Plus className="w-4 h-4 mr-1" /> Add Reminder
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader><DialogTitle className="font-serif text-xl">Add Reminder</DialogTitle></DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label>Reminder</Label>
                          <Input placeholder="e.g. Pay rent" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} data-testid="input-reminder-title" />
                        </div>
                        <div>
                          <Label>Type</Label>
                          <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {REMINDER_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Time (optional)</Label>
                          <Input type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} />
                        </div>
                        <Button onClick={handleSave} disabled={!form.title} className="w-full bg-primary" data-testid="button-save-reminder">Save</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                  <Button size="sm" variant="ghost" onClick={() => setSelectedDate(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {dayReminders.length === 0 ? (
                <p className="text-muted-foreground text-sm py-4 text-center">No reminders for this day. Click "Add Reminder" to add one.</p>
              ) : (
                <div className="space-y-2">
                  <AnimatePresence>
                    {dayReminders.map(r => (
                      <motion.div key={r.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="flex items-center gap-3 p-3 rounded-xl bg-muted/40" data-testid={`reminder-item-${r.id}`}>
                        <Badge className={`text-xs flex-shrink-0 ${TYPE_COLORS[r.type] || TYPE_COLORS.other}`}>
                          {REMINDER_TYPES.find(t => t.value === r.type)?.label}
                        </Badge>
                        <span className="text-sm font-medium flex-1">{r.title}</span>
                        {r.time && <span className="text-xs text-muted-foreground">{r.time}</span>}
                        <button onClick={() => handleDelete(r.id)} className="text-muted-foreground hover:text-destructive transition-colors" data-testid={`button-delete-reminder-${r.id}`}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
