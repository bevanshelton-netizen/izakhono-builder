(() => {
  const db = () => window.supabaseClient || window.db || window.supabase;
  const roles = ["owner", "admin", "manager", "member", "viewer"];

  async function mount() {
    if (document.getElementById("connect029")) return;

    const client = db();
    if (!client) return;

    const button = document.createElement("button");
    button.id = "connect029";
    button.textContent = "Workspace Admin";
    button.addEventListener("click", async () => {
      const sessionResult = await client.auth.getSession();
      const userId = sessionResult?.data?.session?.user?.id;
      if (!userId) {
        window.alert("Please sign in first.");
        return;
      }

      const membershipResult = await client
        .from("connect_workspace_members")
        .select("workspace_id,role")
        .eq("user_id", userId);
      if (membershipResult.error) {
        window.alert(membershipResult.error.message);
        return;
      }

      const workspaceIds = (membershipResult.data || [])
        .filter((membership) => ["owner", "admin"].includes(membership.role))
        .map((membership) => membership.workspace_id);
      if (!workspaceIds.length) {
        window.alert("Admin permission required.");
        return;
      }

      const workspaceResult = await client
        .from("connect_workspaces")
        .select("id,name")
        .in("id", workspaceIds);
      if (workspaceResult.error) {
        window.alert(workspaceResult.error.message);
        return;
      }

      const panel = document.createElement("div");
      panel.id = "connect029panel";
      const dialog = document.createElement("section");
      dialog.className = "c029";
      const close = document.createElement("button");
      close.type = "button";
      close.textContent = "Close";
      close.addEventListener("click", () => panel.remove());
      const heading = document.createElement("h2");
      heading.textContent = "Workspace Administration";
      const description = document.createElement("p");
      description.textContent = "Manage workspace member roles.";
      const workspaceSelect = document.createElement("select");
      workspaceSelect.id = "c029w";
      for (const workspace of workspaceResult.data || []) {
        const option = document.createElement("option");
        option.value = workspace.id;
        option.textContent = workspace.name;
        workspaceSelect.append(option);
      }
      const members = document.createElement("div");
      members.id = "c029m";
      members.textContent = "Loading…";
      dialog.append(close, heading, description, workspaceSelect, members);
      panel.append(dialog);
      document.body.append(panel);

      async function loadMembers() {
        members.replaceChildren();
        members.textContent = "Loading…";
        const workspaceId = workspaceSelect.value;
        const result = await client
          .from("connect_workspace_members")
          .select("user_id,role")
          .eq("workspace_id", workspaceId);
        if (result.error) {
          members.textContent = result.error.message;
          return;
        }

        members.replaceChildren();
        for (const member of result.data || []) {
          const row = document.createElement("div");
          row.className = "c029row";
          const label = document.createElement("span");
          label.textContent = `${String(member.user_id).slice(0, 8)} — ${member.role}`;
          const roleSelect = document.createElement("select");
          roleSelect.dataset.userId = member.user_id;
          for (const role of roles) {
            const option = document.createElement("option");
            option.value = role;
            option.textContent = role;
            roleSelect.append(option);
          }
          roleSelect.value = member.role;
          const save = document.createElement("button");
          save.type = "button";
          save.textContent = "Save";
          save.addEventListener("click", async () => {
            save.disabled = true;
            const update = await client.rpc("connect_workspace_set_member_role", {
              p_workspace_id: workspaceId,
              p_target_user_id: member.user_id,
              p_role: roleSelect.value,
            });
            save.disabled = false;
            if (update.error) {
              window.alert(update.error.message);
              return;
            }
            await loadMembers();
          });
          row.append(label, roleSelect, save);
          members.append(row);
        }
      }

      workspaceSelect.addEventListener("change", loadMembers);
      await loadMembers();
    });

    document.body.append(button);
    const style = document.createElement("style");
    style.textContent = `
      #connect029panel{position:fixed;inset:0;background:#0009;z-index:99999;display:grid;place-items:center;padding:18px}
      .c029{width:min(680px,100%);max-height:85vh;overflow:auto;background:#091525;color:#fff;padding:22px;border-radius:18px}
      .c029row{display:flex;gap:8px;align-items:center;justify-content:space-between;border-top:1px solid #ffffff18;padding:12px 0}
      .c029 select,.c029 button{background:#102238;color:#fff;border:1px solid #ffffff22;border-radius:8px;padding:8px}
      @media(max-width:600px){.c029row{flex-wrap:wrap}}
    `;
    document.head.append(style);
  }

  document.addEventListener("DOMContentLoaded", mount);
})();
