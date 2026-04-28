import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Eye, EyeOff } from "lucide-react";

export default function DispatcherAdmin() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedDispatcher, setSelectedDispatcher] = useState<any>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Form states
  const [createForm, setCreateForm] = useState({ email: "", password: "", name: "", phone: "" });
  const [editForm, setEditForm] = useState({ name: "", phone: "", status: "active" });
  const [passwordForm, setPasswordForm] = useState({ newPassword: "", confirmPassword: "" });

  // Queries and mutations
  const utils = trpc.useUtils();
  const { data: dispatchers, isLoading } = trpc.dispatcherAdmin.list.useQuery();

  const createMutation = trpc.dispatcherAdmin.create.useMutation({
    onSuccess: () => {
      toast.success("Dispatcher creat cu succes!");
      setCreateForm({ email: "", password: "", name: "", phone: "" });
      setIsCreateOpen(false);
      utils.dispatcherAdmin.list.invalidate();
    },
    onError: (error: any) => {
      toast.error(error.message || "Eroare la crearea dispatcherului");
    },
  });

  const updateMutation = trpc.dispatcherAdmin.update.useMutation({
    onSuccess: () => {
      toast.success("Dispatcher actualizat cu succes!");
      setIsEditOpen(false);
      utils.dispatcherAdmin.list.invalidate();
    },
    onError: (error: any) => {
      toast.error(error.message || "Eroare la actualizare");
    },
  });

  const updatePasswordMutation = trpc.dispatcherAdmin.updatePassword.useMutation({
    onSuccess: () => {
      toast.success("Parolă schimbată cu succes!");
      setPasswordForm({ newPassword: "", confirmPassword: "" });
    },
    onError: (error: any) => {
      toast.error(error.message || "Eroare la schimbarea parolei");
    },
  });

  const deleteMutation = trpc.dispatcherAdmin.delete.useMutation({
    onSuccess: () => {
      toast.success("Dispatcher șters cu succes!");
      utils.dispatcherAdmin.list.invalidate();
    },
    onError: (error: any) => {
      toast.error(error.message || "Eroare la ștergere");
    },
  });

  const handleCreate = () => {
    if (!createForm.email || !createForm.password || !createForm.name) {
      toast.error("Email, parolă și nume sunt obligatorii");
      return;
    }
    if (createForm.password.length < 8) {
      toast.error("Parola trebuie să aibă minim 8 caractere");
      return;
    }
    createMutation.mutate(createForm);
  };

  const handleEdit = () => {
    if (!selectedDispatcher) return;
    updateMutation.mutate({
      id: selectedDispatcher.id,
      name: editForm.name || undefined,
      phone: editForm.phone || undefined,
      status: editForm.status as "active" | "inactive" | "suspended",
    });
  };

  const handleChangePassword = () => {
    if (!selectedDispatcher) return;
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("Parolele nu se potrivesc");
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      toast.error("Parola trebuie să aibă minim 8 caractere");
      return;
    }
    updatePasswordMutation.mutate({
      id: selectedDispatcher.id,
      newPassword: passwordForm.newPassword,
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("Ești sigur că vrei să ștergi acest dispatcher?")) {
      deleteMutation.mutate({ id });
    }
  };

  const openEditDialog = (dispatcher: any) => {
    setSelectedDispatcher(dispatcher);
    setEditForm({
      name: dispatcher.name,
      phone: dispatcher.phone || "",
      status: dispatcher.status,
    });
    setPasswordForm({ newPassword: "", confirmPassword: "" });
    setIsEditOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-white text-xl">Se încarcă...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-white">Gestionare Dispatcheri</h1>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold gap-2">
                <Plus size={20} /> Adaugă Dispatcher
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-gray-900 border-gray-700">
              <DialogHeader>
                <DialogTitle className="text-white">Crează Dispatcher Nou</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Input
                  type="email"
                  placeholder="Email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  className="bg-gray-800 border-gray-600 text-white"
                />
                <Input
                  type="password"
                  placeholder="Parolă (min 8 caractere)"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  className="bg-gray-800 border-gray-600 text-white"
                />
                <Input
                  type="text"
                  placeholder="Nume"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="bg-gray-800 border-gray-600 text-white"
                />
                <Input
                  type="tel"
                  placeholder="Telefon (opțional)"
                  value={createForm.phone}
                  onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                  className="bg-gray-800 border-gray-600 text-white"
                />
                <Button
                  onClick={handleCreate}
                  disabled={createMutation.isPending}
                  className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold"
                >
                  {createMutation.isPending ? "Se creează..." : "Crează"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Dispatchers List */}
        <div className="grid gap-4">
          {dispatchers && dispatchers.length > 0 ? (
            dispatchers.map((dispatcher: any) => (
              <Card key={dispatcher.id} className="bg-gray-900 border-gray-700">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-white">{dispatcher.name}</h3>
                        <Badge
                          className={
                            dispatcher.status === "active"
                              ? "bg-green-500/20 text-green-400"
                              : dispatcher.status === "inactive"
                              ? "bg-gray-500/20 text-gray-400"
                              : "bg-red-500/20 text-red-400"
                          }
                        >
                          {dispatcher.status === "active" ? "Activ" : dispatcher.status === "inactive" ? "Inactiv" : "Suspendat"}
                        </Badge>
                      </div>
                      <p className="text-gray-400 mb-1">📧 {dispatcher.email}</p>
                      {dispatcher.phone && <p className="text-gray-400 mb-1">📱 {dispatcher.phone}</p>}
                      <p className="text-gray-500 text-sm">Creat: {new Date(dispatcher.createdAt).toLocaleDateString("ro-RO")}</p>
                    </div>
                    <div className="flex gap-2">
                      <Dialog open={isEditOpen && selectedDispatcher?.id === dispatcher.id} onOpenChange={setIsEditOpen}>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(dispatcher)}
                            className="border-gray-600 text-yellow-500 hover:bg-gray-800"
                          >
                            <Edit size={18} />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-gray-900 border-gray-700 max-w-2xl">
                          <DialogHeader>
                            <DialogTitle className="text-white">Editează Dispatcher</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-6">
                            {/* Edit Info */}
                            <div className="space-y-4">
                              <h3 className="text-white font-semibold">Informații Generale</h3>
                              <Input
                                type="text"
                                placeholder="Nume"
                                value={editForm.name}
                                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                className="bg-gray-800 border-gray-600 text-white"
                              />
                              <Input
                                type="tel"
                                placeholder="Telefon"
                                value={editForm.phone}
                                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                                className="bg-gray-800 border-gray-600 text-white"
                              />
                              <div>
                                <label className="text-gray-400 text-sm mb-2 block">Status</label>
                                <select
                                  value={editForm.status}
                                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                                  className="w-full bg-gray-800 border border-gray-600 text-white rounded px-3 py-2"
                                >
                                  <option value="active">Activ</option>
                                  <option value="inactive">Inactiv</option>
                                  <option value="suspended">Suspendat</option>
                                </select>
                              </div>
                              <Button
                                onClick={handleEdit}
                                disabled={updateMutation.isPending}
                                className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold"
                              >
                                {updateMutation.isPending ? "Se actualizează..." : "Salvează Modificări"}
                              </Button>
                            </div>

                            {/* Change Password */}
                            <div className="space-y-4 border-t border-gray-700 pt-6">
                              <h3 className="text-white font-semibold">Schimbă Parolă</h3>
                              <div className="relative">
                                <Input
                                  type={showPassword ? "text" : "password"}
                                  placeholder="Parolă nouă"
                                  value={passwordForm.newPassword}
                                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                                  className="bg-gray-800 border-gray-600 text-white pr-10"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowPassword(!showPassword)}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                                >
                                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                              </div>
                              <Input
                                type={showPassword ? "text" : "password"}
                                placeholder="Confirmă parolă nouă"
                                value={passwordForm.confirmPassword}
                                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                                className="bg-gray-800 border-gray-600 text-white"
                              />
                              <Button
                                onClick={handleChangePassword}
                                disabled={updatePasswordMutation.isPending}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold"
                              >
                                {updatePasswordMutation.isPending ? "Se schimbă..." : "Schimbă Parolă"}
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>

                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(dispatcher.id)}
                        disabled={deleteMutation.isPending}
                        className="bg-red-600/20 text-red-400 hover:bg-red-600/40"
                      >
                        <Trash2 size={18} />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="bg-gray-900 border-gray-700">
              <CardContent className="p-6 text-center">
                <p className="text-gray-400">Nu sunt dispatcheri creați. Adaugă unul nou pentru a începe.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
