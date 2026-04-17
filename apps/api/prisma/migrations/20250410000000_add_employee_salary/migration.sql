-- salary column already exists in baseline — this migration only adds the expense link.

-- Add employee_id to expenses for linking salary expenses to employees
ALTER TABLE "expenses" ADD COLUMN "employee_id" UUID;

-- Create index on employee_id
CREATE INDEX "expenses_employee_id_idx" ON "expenses"("employee_id");

-- Add foreign key
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
