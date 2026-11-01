CREATE TABLE `official_results` (
	`date` text NOT NULL,
	`venue` text NOT NULL,
	`race` integer NOT NULL,
	`status` text NOT NULL,
	`payload` text NOT NULL,
	`retrieved_at` text NOT NULL,
	PRIMARY KEY(`date`, `venue`, `race`)
);
--> statement-breakpoint
CREATE TABLE `result_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`started_ms` integer NOT NULL
);
