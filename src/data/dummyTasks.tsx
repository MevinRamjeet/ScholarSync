export type Task = {
  id: string;
  title: string;
  course: string;
  dueDate: string;
  status: "pending" | "completed";
};

export const dummyTasks: Task[] = [
  {
    id: "1",
    title: "Calculus Assignment 3",
    course: "Math 101",
    dueDate: "2026-08-10",
    status: "pending",
  },
  {
    id: "2",
    title: "Read Chapter 4",
    course: "History 201",
    dueDate: "2026-08-05",
    status: "completed",
  },
  {
    id: "3",
    title: "Physics Lab Report",
    course: "Physics 202",
    dueDate: "2026-08-12",
    status: "pending",
  },
  {
    id: "4",
    title: "Essay Draft",
    course: "English 105",
    dueDate: "2026-08-15",
    status: "pending",
  },
];
