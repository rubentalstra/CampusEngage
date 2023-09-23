CREATE TABLE `countries` (
    `country_id` INT NOT NULL AUTO_INCREMENT,
    `country_name` VARCHAR(255) NOT NULL,
    PRIMARY KEY (`country_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `address_info` (
    `id` CHAR(36) NOT NULL DEFAULT (UUID()), 
    `street_address` TEXT NOT NULL,
    `postal_code` VARCHAR(10) NOT NULL,
    `city` VARCHAR(255) NOT NULL,
    `country_id` INT NOT NULL,
    PRIMARY KEY (`id`),
    FOREIGN KEY (`country_id`) REFERENCES `countries`(`country_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `users` (
    `id` CHAR(36) NOT NULL DEFAULT (UUID()),
    `type_name` ENUM('Aspirant-lid', 'Donateur') NOT NULL,
    `status` ENUM('pending', 'verified', 'active') NOT NULL,
    `initials` VARCHAR(255),
    `first_name` VARCHAR(255) NOT NULL,
    `primary_last_name_prefix` VARCHAR(255),
    `primary_last_name_main` VARCHAR(255) NOT NULL,
    `geslacht` ENUM('m', 'f', 'o') NOT NULL,
    `geboortedatum` DATE NOT NULL,
    `emailadres` VARCHAR(255) NOT NULL,
    `mobiele_telefoon` VARCHAR(20),
    `vaste_telefoon` VARCHAR(20) DEFAULT '-',
    `address_id` CHAR(36), -- Link to the address_info table, with updated data type
    `iban` VARCHAR(34),
    `bic` VARCHAR(11),
    `sepa_machtiging_date` DATE,
    `sepa_referentie` VARCHAR(255),
    `studentnummer` INT NOT NULL,
    `lid_sinds` DATE NOT NULL,
    `hash` varchar(200),
    `salt` varchar(100),
    `verification_token` varchar(100),
    `token_expiration_date` DATETIME,
    `twoFA_secret` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
    `hasFA` int NOT NULL DEFAULT '0',
    `imagePath` varchar(255) DEFAULT NULL,
    `publicImage` tinyint DEFAULT 0,
    PRIMARY KEY (`id`),
    FOREIGN KEY (`address_id`) REFERENCES `address_info`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
