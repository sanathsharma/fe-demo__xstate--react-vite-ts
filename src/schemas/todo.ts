import z, { object, string, boolean } from "zod";
export const todoBaseSchema = object({
	id: string().uuid(),
	title: string().trim().min(1),
	description: string().trim().min(1).nullable().default(null),
	dueDate: string().datetime(),
	isCompleted: boolean().default(false),
	completedOn: string().datetime().nullable().default(null),
	isDeleted: boolean().default(false),
	createdAt: string().datetime(),
	updatedAt: string().datetime(),
	deletedAt: string().datetime().nullable().default(null),
});

export const createTodoSchema = todoBaseSchema.pick({
	title: true,
	description: true,
	dueDate: true,
	isCompleted: true,
	completedOn: true,
});

export const updateTodoSchema = todoBaseSchema
	.omit({
		createdAt: true,
		updatedAt: true,
		isDeleted: true,
		deletedAt: true,
	})
	.partial()
	.required({ id: true });

export type Todo = z.infer<typeof todoBaseSchema>;
export type Todo_fc = z.infer<typeof createTodoSchema>;
export type Todo_fu = z.infer<typeof updateTodoSchema>;
