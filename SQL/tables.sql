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

CREATE TABLE `MemberTypes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `type_name` varchar(255) NOT NULL,
  `category` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `type_name` (`type_name`)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `Members` (
  `id` char(36) NOT NULL DEFAULT (uuid()),
  `status` enum('pending','verified','active') NOT NULL,
  `member_type_id` int NOT NULL DEFAULT '1',
  `initials` varchar(255) DEFAULT NULL,
  `first_name` varchar(255) NOT NULL,
  `primary_last_name_prefix` varchar(255) DEFAULT NULL,
  `primary_last_name_main` varchar(255) NOT NULL,
  `geslacht` enum('m','f','o') NOT NULL,
  `geboortedatum` date NOT NULL,
  `emailadres` varchar(255) NOT NULL,
  `mobiele_telefoon` varchar(20) DEFAULT NULL,
  `vaste_telefoon` varchar(20) DEFAULT '-',
  `address_id` char(36) DEFAULT NULL,
  `iban` varchar(34) DEFAULT NULL,
  `bic` varchar(11) DEFAULT NULL,
  `sepa_machtiging_date` date DEFAULT NULL,
  `sepa_referentie` varchar(255) DEFAULT NULL,
  `studentnummer` int NOT NULL,
  `lid_sinds` date NOT NULL,
  `hash` varchar(200) DEFAULT NULL,
  `salt` varchar(100) DEFAULT NULL,
  `verification_token` varchar(100) DEFAULT NULL,
  `token_expiration_date` datetime DEFAULT NULL,
  `twoFA_secret` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `hasFA` int NOT NULL DEFAULT '0',
  `imagePath` varchar(255) DEFAULT NULL,
  `publicImage` tinyint DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `address_id` (`address_id`),
  KEY `member_type_id` (`member_type_id`),
  CONSTRAINT `users_ibfk_1` FOREIGN KEY (`address_id`) REFERENCES `address_info` (`id`),
  CONSTRAINT `users_ibfk_2` FOREIGN KEY (`member_type_id`) REFERENCES `MemberTypes` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;




-- new tables

CREATE TABLE Events (
    EventID INT PRIMARY KEY AUTO_INCREMENT,
    Name VARCHAR(255) NOT NULL,
    Category VARCHAR(255) NOT NULL,
    StartDateTime DATETIME NOT NULL,
    EndDateTime DATETIME NOT NULL,
    AllDay BOOLEAN DEFAULT FALSE,
    Location TEXT NOT NULL,
    Organizer VARCHAR(255) NOT NULL,
    Notes TEXT,
    AvailableQuantity INT,
    Published ENUM('published', 'draft') NOT NULL DEFAULT 'draft'
);

CREATE TABLE TicketTypes (
    TicketTypeID INT PRIMARY KEY AUTO_INCREMENT,
    EventID INT,
    TicketName VARCHAR(255) NOT NULL,
    Description TEXT,
    AvailableFrom DATETIME NOT NULL,
    AvailableUntil DATETIME NOT NULL,
    CancelableUntil DATETIME,
    HasPrice BOOLEAN DEFAULT FALSE,
    Price DECIMAL(10,2) DEFAULT 0,
    Visibility ENUM('Members', 'Public') NOT NULL,
    MaxTickets INT DEFAULT NULL,
    LimitType ENUM('Per order', 'Per member') NOT NULL,
    FOREIGN KEY (EventID) REFERENCES Events(EventID)
);

CREATE TABLE Attendees (
    AttendeeID INT PRIMARY KEY AUTO_INCREMENT,
    EventID INT NOT NULL,
    TicketTypeID INT NOT NULL,
    MemberID CHAR(36) NOT NULL,
    OrderDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    AssignedName VARCHAR(255),
    Status ENUM('Ordered', 'Cancelled') NOT NULL DEFAULT 'Ordered',
    FOREIGN KEY (EventID) REFERENCES Events(EventID),
    FOREIGN KEY (TicketTypeID) REFERENCES TicketTypes(TicketTypeID),
    FOREIGN KEY (MemberID) REFERENCES Members(id)
);
