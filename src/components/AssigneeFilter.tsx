"use client";

type AssigneeOption = {
  id: string;
  name: string;
};

export function AssigneeFilter({
  users,
  selectedAssigneeId,
}: {
  users: AssigneeOption[];
  selectedAssigneeId: string;
}) {
  return (
    <form method="get">
      <select
        name="assignee"
        defaultValue={selectedAssigneeId}
        onChange={(event) => event.currentTarget.form?.submit()}
        className="w-full px-3 py-2 rounded-md"
        style={{ border: "1px solid var(--line)", background: "#fff" }}
      >
        <option value="all">Todos los miembros</option>
        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.name}
          </option>
        ))}
      </select>
    </form>
  );
}
