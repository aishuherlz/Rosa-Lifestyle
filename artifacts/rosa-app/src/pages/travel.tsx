import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, MapPin, Compass, Globe, ExternalLink, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useLocalStorage } from "@/hooks/use-local-storage";

type Destination = {
  id: string;
  name: string;
  country: string;
  notes: string;
  addedAt: string;
};

const SEASONAL_SUGGESTIONS: Record<string, { title: string; ideas: string[] }[]> = {
  winter: [
    { title: "Cozy indoor escapes", ideas: ["Hygge café hopping", "Museum day trip", "Spa weekend retreat", "Hot spring visit"] },
    { title: "Winter wonderland", ideas: ["Snow hiking trail", "Christmas market tour", "Ice skating adventure", "Ski resort day trip"] },
  ],
  spring: [
    { title: "Blooming outdoors", ideas: ["Cherry blossom picnic", "Botanical garden walk", "Farmer's market tour", "Sunset hike"] },
    { title: "City discovery", ideas: ["Street art walking tour", "Local food market", "Rooftop cocktails", "Hidden neighbourhood exploration"] },
  ],
  summer: [
    { title: "Beach & water", ideas: ["Coastal road trip", "Snorkelling adventure", "Sunset boat cruise", "Wild swimming spot"] },
    { title: "Outdoor adventures", ideas: ["Camping under stars", "Waterfall hike", "Island hopping", "Open air festival"] },
  ],
  autumn: [
    { title: "Golden season", ideas: ["Forest foliage hike", "Apple orchard visit", "Harvest festival", "Scenic train journey"] },
    { title: "Cultural escapes", ideas: ["Wine country tour", "Art gallery weekend", "Literary city tour", "Cozy village stay"] },
  ],
};

function getSeason(): string {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) return "spring";
  if (month >= 5 && month <= 7) return "summer";
  if (month >= 8 && month <= 10) return "autumn";
  return "winter";
}

const DESTINATION_GRADIENTS = [
  "from-rose-400 to-orange-300",
  "from-violet-400 to-blue-300",
  "from-emerald-400 to-teal-300",
  "from-amber-400 to-rose-300",
  "from-sky-400 to-indigo-300",
  "from-fuchsia-400 to-violet-300",
];

export default function TravelPage() {
  const [destinations, setDestinations] = useLocalStorage<Destination[]>("rosa_destinations", []);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", country: "", notes: "" });
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [locationName, setLocationName] = useState("");
  const season = getSeason();
  const suggestions = SEASONAL_SUGGESTIONS[season];

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(pos => {
      setUserLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      setLocationName("your area");
    });
  }, []);

  const handleAdd = () => {
    const item: Destination = { id: Date.now().toString(), ...form, addedAt: new Date().toISOString() };
    setDestinations([...destinations, item]);
    setOpen(false);
    setForm({ name: "", country: "", notes: "" });
  };

  const getMapsLink = (dest: Destination) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${dest.name}, ${dest.country}`)}`;
  const getLocalMapsLink = () => userLocation ? `https://www.google.com/maps/search/?api=1&query=things+to+do+near+me&ll=${userLocation.lat},${userLocation.lon}` : "https://www.google.com/maps/";

  return (
    <div className="min-h-full p-4 md:p-8 space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-serif text-foreground">Travel & Places</h1>
            <p className="text-muted-foreground mt-1">Wanderlust, captured.</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90" data-testid="button-add-destination">
                <Plus className="w-4 h-4 mr-1" /> Add Destination
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle className="font-serif text-xl">Dream Destination</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>City or Place</Label>
                  <Input placeholder="e.g. Kyoto" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} data-testid="input-destination-name" />
                </div>
                <div>
                  <Label>Country</Label>
                  <Input placeholder="e.g. Japan" value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} data-testid="input-destination-country" />
                </div>
                <div>
                  <Label>Notes & Dreams</Label>
                  <Textarea placeholder="Things you want to do there..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="resize-none" />
                </div>
                <Button onClick={handleAdd} disabled={!form.name} className="w-full bg-primary" data-testid="button-save-destination">Add to Bucket List</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </motion.div>

      {/* Local suggestions */}
      <Card className="border-border/50 shadow-sm bg-gradient-to-br from-sky-50 to-blue-50 border-sky-200">
        <CardHeader className="pb-2">
          <CardTitle className="font-serif text-lg flex items-center gap-2">
            <Navigation className="w-5 h-5 text-sky-500" /> Near You
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">Discover what's around {locationName || "you"} this {season}.</p>
          <a href={getLocalMapsLink()} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline" className="border-sky-300 text-sky-700 hover:bg-sky-50" data-testid="link-local-maps">
              <MapPin className="w-4 h-4 mr-1" /> Explore on Maps <ExternalLink className="w-3 h-3 ml-1" />
            </Button>
          </a>
        </CardContent>
      </Card>

      {/* Weekend suggestions */}
      <div>
        <h2 className="text-xl font-serif mb-3 flex items-center gap-2 capitalize">
          <Compass className="w-5 h-5 text-primary" /> {season} Weekend Ideas
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {suggestions.map((group) => (
            <Card key={group.title} className="border-border/50 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground">{group.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {group.ideas.map(idea => (
                  <div key={idea} className="flex items-center gap-2 text-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                    {idea}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Dream destinations */}
      {destinations.length > 0 && (
        <div>
          <h2 className="text-xl font-serif mb-3 flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" /> Your Bucket List
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence>
              {destinations.map((dest, i) => (
                <motion.div key={dest.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} data-testid={`card-destination-${dest.id}`}>
                  <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                    <div className={`h-20 bg-gradient-to-br ${DESTINATION_GRADIENTS[i % DESTINATION_GRADIENTS.length]} flex items-end p-4`}>
                      <div className="text-white">
                        <h3 className="font-serif font-semibold text-lg leading-tight">{dest.name}</h3>
                        <p className="text-sm opacity-90">{dest.country}</p>
                      </div>
                    </div>
                    <CardContent className="pt-3 pb-4">
                      {dest.notes && <p className="text-sm text-muted-foreground mb-3 line-clamp-2 italic">"{dest.notes}"</p>}
                      <div className="flex gap-2">
                        <a href={getMapsLink(dest)} target="_blank" rel="noopener noreferrer" className="flex-1">
                          <Button size="sm" variant="outline" className="w-full text-xs" data-testid={`link-maps-${dest.id}`}>
                            <MapPin className="w-3 h-3 mr-1" /> View on Maps
                          </Button>
                        </a>
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDestinations(destinations.filter(d => d.id !== dest.id))} data-testid={`button-delete-destination-${dest.id}`}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {destinations.length === 0 && (
        <Card className="border-dashed border-2 border-border text-center py-12">
          <CardContent>
            <Globe className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground text-lg font-serif">Your bucket list awaits</p>
            <p className="text-muted-foreground text-sm mt-1">Add destinations you dream of visiting</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
