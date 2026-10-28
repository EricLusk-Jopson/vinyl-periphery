import React from "react";
import { RolePerson } from "@/lib/filters";
import {
  groupRoles,
  ROLE_CATEGORIES,
  roleCategory,
} from "@/lib/transformers/roleCategories";
import { cn } from "@/lib/utils";

const Heading: React.FC<{ eyebrow: string; title: string }> = ({
  eyebrow,
  title,
}) => (
  <div className="mb-2 flex flex-col gap-0.5">
    <span className="font-mono text-xs uppercase tracking-[1px] text-faint">
      {eyebrow}
    </span>
    <span className="font-medium">{title}</span>
  </div>
);

/** A contributor's roles on the searched album, by category. */
export const ContributorDetails: React.FC<{
  name: string;
  roles: string[];
}> = ({ name, roles }) => (
  <div>
    <Heading eyebrow="On this album" title={name} />
    {roles.length === 0 ? (
      <p className="text-muted-foreground">No roles listed.</p>
    ) : (
      <dl className="flex flex-col gap-1.5">
        {groupRoles(roles, (r) => r).map((group) => (
          <div key={group.id}>
            <dt className="text-xs text-faint">{group.label}</dt>
            <dd className="text-muted-foreground">{group.items.join(", ")}</dd>
          </div>
        ))}
      </dl>
    )}
  </div>
);

/** Who had a role on the searched album; people switched off are struck. */
export const RoleDetails: React.FC<{ role: string; people: RolePerson[] }> = ({
  role,
  people,
}) => (
  <div>
    <Heading
      eyebrow={
        ROLE_CATEGORIES.find((c) => c.id === roleCategory(role))?.label ?? ""
      }
      title={role}
    />
    <ul className="flex flex-col gap-1">
      {people.map((p) => (
        <li
          key={p.id}
          className={cn(
            p.included ? "text-muted-foreground" : "text-faint line-through",
          )}
        >
          {p.name}
          {!p.included && <span className="sr-only"> (switched off)</span>}
        </li>
      ))}
    </ul>
  </div>
);
