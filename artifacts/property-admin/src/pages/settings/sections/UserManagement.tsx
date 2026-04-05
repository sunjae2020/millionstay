import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { UserPlus, Trash2, Shield, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: "Super Admin" | "Admin" | "Viewer";
  status: "Active" | "Invited";
  created_at: string;
}

const ROLE_COLORS: Record<string, string> = {
  "Super Admin": "destructive",
  Admin: "default",
  Viewer: "secondary",
};

const INITIAL_USERS: AdminUser[] = [
  { id: 1, name: "System Admin", email: "admin@millionstay.com.au", role: "Super Admin", status: "Active", created_at: "2026-01-01" },
];

export function UserManagement() {
  const { toast } = useToast();
  const [users, setUsers] = useState<AdminUser[]>(INITIAL_USERS);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", role: "Admin" });

  function handleInvite() {
    if (!form.email || !form.name) return;
    const newUser: AdminUser = {
      id: Date.now(),
      name: form.name,
      email: form.email,
      role: form.role as AdminUser["role"],
      status: "Invited",
      created_at: new Date().toISOString().split("T")[0],
    };
    setUsers((prev) => [...prev, newUser]);
    setForm({ name: "", email: "", role: "Admin" });
    setOpen(false);
    toast({ title: "Invitation sent", description: `An invite has been sent to ${form.email}.` });
  }

  function handleRemove(id: number) {
    setUsers((prev) => prev.filter((u) => u.id !== id));
    toast({ title: "User removed" });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Admin Accounts</h3>
          <p className="text-sm text-muted-foreground mt-0.5">Users with access to the admin panel</p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Invite Admin
        </Button>
      </div>

      <div className="rounded-lg border divide-y">
        {users.map((user) => (
          <div key={user.id} className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                {user.role === "Super Admin" ? (
                  <Shield className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <User className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium">{user.name}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={ROLE_COLORS[user.role] as "default" | "destructive" | "secondary"}>{user.role}</Badge>
              {user.status === "Invited" && (
                <Badge variant="outline" className="text-amber-600 border-amber-300">Invited</Badge>
              )}
              {user.role !== "Super Admin" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => handleRemove(user.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <Separator />

      <div>
        <h3 className="text-base font-semibold">Role Descriptions</h3>
        <div className="mt-3 space-y-2 text-sm">
          {[
            { role: "Super Admin", desc: "Full access to all features including system settings" },
            { role: "Admin", desc: "Read and write access to all data, limited settings access" },
            { role: "Viewer", desc: "Read-only access across all modules" },
          ].map(({ role, desc }) => (
            <div key={role} className="flex items-start gap-2">
              <Badge variant={ROLE_COLORS[role] as "default" | "destructive" | "secondary"} className="mt-0.5 shrink-0">{role}</Badge>
              <span className="text-muted-foreground">{desc}</span>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Admin</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Full name"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="user@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Admin">Admin</SelectItem>
                  <SelectItem value="Viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleInvite}>Send Invite</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
