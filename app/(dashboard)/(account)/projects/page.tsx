import type { Metadata } from "next";
import { Suspense } from "react";
import { ProjectsView } from "@/components/projects/projects-view";
import { LoadingState } from "@/components/common/states";

export const metadata: Metadata = { title: "โปรเจกต์" };

export default function ProjectsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <ProjectsView />
    </Suspense>
  );
}
