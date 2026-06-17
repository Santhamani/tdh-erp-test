-- TDH ERP MySQL schema aligned with existing Firestore collections.
-- MySQL 8.0+

CREATE DATABASE IF NOT EXISTS tdh_erp
	CHARACTER SET utf8mb4
	COLLATE utf8mb4_unicode_ci;

USE tdh_erp;

CREATE TABLE IF NOT EXISTS users (
	id VARCHAR(128) PRIMARY KEY,
	name VARCHAR(120) NOT NULL,
	email VARCHAR(190) NOT NULL UNIQUE,
	role ENUM(
		'ADMIN',
		'MANAGER',
		'ASSISTANT_MANAGER',
		'GATE_ENTRY_OPERATOR',
		'WEIGHING_OPERATOR',
		'QUALITY_OPERATOR',
		'BIN_OPERATOR',
		'STORE_MANAGER',
		'PLANT_OPERATOR',
		'PACKAGING_OPERATOR',
		'DISPATCH_OPERATOR'
	) NOT NULL,
	pin_hash VARCHAR(255) NOT NULL,
	password_hash VARCHAR(255) NOT NULL,
	phone VARCHAR(20) NULL,
	address TEXT NULL,
	emergency_contact_name VARCHAR(120) NULL,
	emergency_contact_phone VARCHAR(20) NULL,
	other_details JSON NULL,
	status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
	created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS password_reset_requests (
	id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
	user_id VARCHAR(128) NULL,
	email VARCHAR(190) NOT NULL,
	user_name VARCHAR(120) NULL,
	user_role VARCHAR(60) NULL,
	status ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
	requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	approved_at DATETIME NULL,
	approved_by VARCHAR(128) NULL,
	INDEX idx_prr_email_status (email, status),
	CONSTRAINT fk_prr_user FOREIGN KEY (user_id) REFERENCES users(id),
	CONSTRAINT fk_prr_approved_by FOREIGN KEY (approved_by) REFERENCES users(id)
);

-- arrival_records in Firestore
CREATE TABLE IF NOT EXISTS arrival_records (
	id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
	firestore_doc_id VARCHAR(128) NULL UNIQUE,
	serial_number VARCHAR(20) NULL,
	gate_mode ENUM('in', 'out') NOT NULL,
	vehicle_number VARCHAR(20) NOT NULL,
	driver_name VARCHAR(120) NULL,
	phone_number VARCHAR(20) NULL,
	from_location VARCHAR(120) NULL,
	to_location VARCHAR(120) NULL,
	party VARCHAR(120) NULL,
	broker_name VARCHAR(120) NULL,
	broker_phone VARCHAR(20) NULL,
	quantity DECIMAL(12,2) NULL,
	bags INT NULL,
	item VARCHAR(120) NULL,
	loading_unloading VARCHAR(20) NULL,
	note TEXT NULL,
	deleted TINYINT(1) NOT NULL DEFAULT 0,
	created_by_user_id VARCHAR(128) NULL,
	created_by_user_name VARCHAR(120) NULL,
	created_at DATETIME NOT NULL,
	details_json JSON NULL,
	INDEX idx_arrival_vehicle_created (vehicle_number, created_at),
	INDEX idx_arrival_gate_mode (gate_mode),
	INDEX idx_arrival_deleted (deleted),
	CONSTRAINT fk_arrival_created_by FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);

-- weighing_records in Firestore
CREATE TABLE IF NOT EXISTS weighing_records (
	id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
	firestore_doc_id VARCHAR(128) NULL UNIQUE,
	vehicle_number VARCHAR(20) NOT NULL,
	ticket_no VARCHAR(80) NULL,
	gross_weight DECIMAL(12,2) NULL,
	tare_weight DECIMAL(12,2) NULL,
	sample_collector VARCHAR(120) NULL,
	note TEXT NULL,
	deleted TINYINT(1) NOT NULL DEFAULT 0,
	created_by_user_id VARCHAR(128) NULL,
	created_by_user_name VARCHAR(120) NULL,
	created_at DATETIME NOT NULL,
	details_json JSON NULL,
	INDEX idx_weighing_vehicle_created (vehicle_number, created_at),
	INDEX idx_weighing_ticket_no (ticket_no),
	INDEX idx_weighing_deleted (deleted),
	CONSTRAINT fk_weighing_created_by FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);

-- quality-check_records in Firestore
CREATE TABLE IF NOT EXISTS quality_check_records (
	id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
	firestore_doc_id VARCHAR(128) NULL UNIQUE,
	vehicle_number VARCHAR(20) NOT NULL,
	transaction_id VARCHAR(80) NULL,
	size_analysis_7 DECIMAL(8,2) NULL,
	size_analysis_5 DECIMAL(8,2) NULL,
	size_analysis_4 DECIMAL(8,2) NULL,
	small_mud_percent DECIMAL(8,2) NULL,
	big_mud_stones_percent DECIMAL(8,2) NULL,
	damage_1 DECIMAL(8,2) NULL,
	physical_damage_2 DECIMAL(8,2) NULL,
	moisture_content_percent DECIMAL(8,2) NULL,
	upload_report LONGTEXT NULL,
	note TEXT NULL,
	deleted TINYINT(1) NOT NULL DEFAULT 0,
	created_by_user_id VARCHAR(128) NULL,
	created_by_user_name VARCHAR(120) NULL,
	created_at DATETIME NOT NULL,
	details_json JSON NULL,
	INDEX idx_qc_vehicle_created (vehicle_number, created_at),
	INDEX idx_qc_transaction_id (transaction_id),
	INDEX idx_qc_deleted (deleted),
	CONSTRAINT fk_qc_created_by FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);

-- dispatch_records in Firestore
CREATE TABLE IF NOT EXISTS dispatch_records (
	id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
	firestore_doc_id VARCHAR(128) NULL UNIQUE,
	vehicle_number VARCHAR(20) NOT NULL,
	driver_name VARCHAR(120) NULL,
	destination VARCHAR(140) NULL,
	client_name VARCHAR(140) NULL,
	ticket_number VARCHAR(80) NULL,
	gross_weight DECIMAL(12,2) NULL,
	tare_weight DECIMAL(12,2) NULL,
	note TEXT NULL,
	deleted TINYINT(1) NOT NULL DEFAULT 0,
	created_by_user_id VARCHAR(128) NULL,
	created_by_user_name VARCHAR(120) NULL,
	created_at DATETIME NOT NULL,
	details_json JSON NULL,
	INDEX idx_dispatch_vehicle_created (vehicle_number, created_at),
	INDEX idx_dispatch_client_created (client_name, created_at),
	INDEX idx_dispatch_deleted (deleted),
	CONSTRAINT fk_dispatch_created_by FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS dispatch_items (
	id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
	dispatch_record_id BIGINT UNSIGNED NOT NULL,
	item_order INT NOT NULL,
	item_name VARCHAR(140) NULL,
	item_type VARCHAR(80) NULL,
	item_quantity DECIMAL(12,2) NULL,
	item_weight DECIMAL(12,2) NULL,
	item_total DECIMAL(14,2) NULL,
	INDEX idx_dispatch_items_dispatch (dispatch_record_id),
	CONSTRAINT fk_dispatch_items_dispatch FOREIGN KEY (dispatch_record_id) REFERENCES dispatch_records(id)
		ON DELETE CASCADE
);

-- sales_records in Firestore
CREATE TABLE IF NOT EXISTS sales_records (
	id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
	firestore_doc_id VARCHAR(128) NULL UNIQUE,
	file_name VARCHAR(255) NULL,
	sales_timestamp DATETIME NULL,
	note TEXT NULL,
	deleted TINYINT(1) NOT NULL DEFAULT 0,
	created_by_user_id VARCHAR(128) NULL,
	created_by_user_name VARCHAR(120) NULL,
	created_at DATETIME NOT NULL,
	details_json JSON NULL,
	INDEX idx_sales_created (created_at),
	INDEX idx_sales_deleted (deleted),
	CONSTRAINT fk_sales_created_by FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);

-- Other stages currently posted through submitStageData can remain flexible.
CREATE TABLE IF NOT EXISTS stage_records (
	id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
	firestore_doc_id VARCHAR(128) NULL UNIQUE,
	stage_id VARCHAR(80) NOT NULL,
	vehicle_number VARCHAR(20) NULL,
	deleted TINYINT(1) NOT NULL DEFAULT 0,
	created_by_user_id VARCHAR(128) NULL,
	created_by_user_name VARCHAR(120) NULL,
	created_at DATETIME NOT NULL,
	details_json JSON NOT NULL,
	INDEX idx_stage_records_stage_created (stage_id, created_at),
	INDEX idx_stage_records_vehicle_created (vehicle_number, created_at),
	INDEX idx_stage_records_deleted (deleted),
	CONSTRAINT fk_stage_records_created_by FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
	id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
	user_id VARCHAR(128) NULL,
	action VARCHAR(80) NOT NULL,
	details_json JSON NULL,
	ip_address VARCHAR(45) NULL,
	created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	INDEX idx_audit_user_created (user_id, created_at),
	INDEX idx_audit_action_created (action, created_at),
	CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id)
);

