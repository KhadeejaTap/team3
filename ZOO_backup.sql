-- MySQL dump 10.13  Distrib 8.0.46, for Linux (x86_64)
--
-- Host: localhost    Database: ZOO
-- ------------------------------------------------------
-- Server version	8.0.46-0ubuntu0.24.04.4

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `ANIMAL`
--

DROP TABLE IF EXISTS `ANIMAL`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ANIMAL` (
  `animal_ID` int NOT NULL AUTO_INCREMENT,
  `species_ID` int NOT NULL,
  `enclosure_ID` int NOT NULL,
  `name` varchar(100) DEFAULT NULL,
  `age` int DEFAULT NULL,
  `gender` varchar(20) DEFAULT NULL,
  `weight` decimal(6,2) DEFAULT NULL,
  `arrival_date` date DEFAULT NULL,
  `breeding_status` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`animal_ID`),
  KEY `species_ID` (`species_ID`),
  KEY `enclosure_ID` (`enclosure_ID`),
  CONSTRAINT `ANIMAL_ibfk_1` FOREIGN KEY (`species_ID`) REFERENCES `SPECIES` (`species_ID`),
  CONSTRAINT `ANIMAL_ibfk_2` FOREIGN KEY (`enclosure_ID`) REFERENCES `ENCLOSURE` (`enclosure_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ANIMAL`
--

LOCK TABLES `ANIMAL` WRITE;
/*!40000 ALTER TABLE `ANIMAL` DISABLE KEYS */;
/*!40000 ALTER TABLE `ANIMAL` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ANIMAL_CARE`
--

DROP TABLE IF EXISTS `ANIMAL_CARE`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ANIMAL_CARE` (
  `animal_ID` int NOT NULL,
  `employee_ID` int NOT NULL,
  PRIMARY KEY (`animal_ID`,`employee_ID`),
  KEY `employee_ID` (`employee_ID`),
  CONSTRAINT `ANIMAL_CARE_ibfk_1` FOREIGN KEY (`animal_ID`) REFERENCES `ANIMAL` (`animal_ID`) ON DELETE CASCADE,
  CONSTRAINT `ANIMAL_CARE_ibfk_2` FOREIGN KEY (`employee_ID`) REFERENCES `EMPLOYEE` (`employee_ID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ANIMAL_CARE`
--

LOCK TABLES `ANIMAL_CARE` WRITE;
/*!40000 ALTER TABLE `ANIMAL_CARE` DISABLE KEYS */;
/*!40000 ALTER TABLE `ANIMAL_CARE` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ATTRACTION`
--

DROP TABLE IF EXISTS `ATTRACTION`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ATTRACTION` (
  `attr_ID` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) DEFAULT NULL,
  `type` varchar(30) DEFAULT NULL,
  `location` varchar(40) DEFAULT NULL,
  `attr_datetime` date DEFAULT NULL,
  `capacity` int DEFAULT NULL,
  `description` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`attr_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ATTRACTION`
--

LOCK TABLES `ATTRACTION` WRITE;
/*!40000 ALTER TABLE `ATTRACTION` DISABLE KEYS */;
/*!40000 ALTER TABLE `ATTRACTION` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ATTR_ANIMAL`
--

DROP TABLE IF EXISTS `ATTR_ANIMAL`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ATTR_ANIMAL` (
  `attr_animal_ID` int NOT NULL AUTO_INCREMENT,
  `animal_ID` int NOT NULL,
  `attr_ID` int NOT NULL,
  PRIMARY KEY (`attr_animal_ID`),
  KEY `animal_ID` (`animal_ID`),
  KEY `attr_ID` (`attr_ID`),
  CONSTRAINT `ATTR_ANIMAL_ibfk_1` FOREIGN KEY (`animal_ID`) REFERENCES `ANIMAL` (`animal_ID`),
  CONSTRAINT `ATTR_ANIMAL_ibfk_2` FOREIGN KEY (`attr_ID`) REFERENCES `ATTRACTION` (`attr_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ATTR_ANIMAL`
--

LOCK TABLES `ATTR_ANIMAL` WRITE;
/*!40000 ALTER TABLE `ATTR_ANIMAL` DISABLE KEYS */;
/*!40000 ALTER TABLE `ATTR_ANIMAL` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ATTR_TICKET`
--

DROP TABLE IF EXISTS `ATTR_TICKET`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ATTR_TICKET` (
  `attr_ticket_ID` int NOT NULL AUTO_INCREMENT,
  `ticket_ID` int NOT NULL,
  `attr_ID` int NOT NULL,
  PRIMARY KEY (`attr_ticket_ID`),
  KEY `ticket_ID` (`ticket_ID`),
  KEY `attr_ID` (`attr_ID`),
  CONSTRAINT `ATTR_TICKET_ibfk_1` FOREIGN KEY (`ticket_ID`) REFERENCES `TICKET` (`ticket_ID`),
  CONSTRAINT `ATTR_TICKET_ibfk_2` FOREIGN KEY (`attr_ID`) REFERENCES `ATTRACTION` (`attr_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ATTR_TICKET`
--

LOCK TABLES `ATTR_TICKET` WRITE;
/*!40000 ALTER TABLE `ATTR_TICKET` DISABLE KEYS */;
/*!40000 ALTER TABLE `ATTR_TICKET` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `CUST_TRANSACTION`
--

DROP TABLE IF EXISTS `CUST_TRANSACTION`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `CUST_TRANSACTION` (
  `transaction_ID` int NOT NULL AUTO_INCREMENT,
  `visitor_ID` int DEFAULT NULL,
  `total` decimal(10,2) DEFAULT NULL,
  `transaction_date` date DEFAULT NULL,
  `payment_method` varchar(50) NOT NULL,
  PRIMARY KEY (`transaction_ID`),
  KEY `visitor_ID` (`visitor_ID`),
  CONSTRAINT `CUST_TRANSACTION_ibfk_1` FOREIGN KEY (`visitor_ID`) REFERENCES `VISITOR` (`visitor_ID`) ON DELETE RESTRICT,
  CONSTRAINT `CUST_TRANSACTION_chk_1` CHECK ((`payment_method` in (_utf8mb4'cash',_utf8mb4'credit',_utf8mb4'debit',_utf8mb4'online')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `CUST_TRANSACTION`
--

LOCK TABLES `CUST_TRANSACTION` WRITE;
/*!40000 ALTER TABLE `CUST_TRANSACTION` DISABLE KEYS */;
/*!40000 ALTER TABLE `CUST_TRANSACTION` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `DEPARTMENT`
--

DROP TABLE IF EXISTS `DEPARTMENT`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `DEPARTMENT` (
  `department_ID` int NOT NULL AUTO_INCREMENT,
  `department_name` varchar(50) DEFAULT NULL,
  `department_description` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`department_ID`),
  UNIQUE KEY `department_name` (`department_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `DEPARTMENT`
--

LOCK TABLES `DEPARTMENT` WRITE;
/*!40000 ALTER TABLE `DEPARTMENT` DISABLE KEYS */;
/*!40000 ALTER TABLE `DEPARTMENT` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `DONATION`
--

DROP TABLE IF EXISTS `DONATION`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `DONATION` (
  `donation_ID` int NOT NULL AUTO_INCREMENT,
  `donor_ID` int NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `donation_date` date NOT NULL,
  `purpose` varchar(225) NOT NULL,
  PRIMARY KEY (`donation_ID`),
  KEY `donor_ID` (`donor_ID`),
  CONSTRAINT `DONATION_ibfk_1` FOREIGN KEY (`donor_ID`) REFERENCES `donor` (`donor_ID`) ON DELETE RESTRICT,
  CONSTRAINT `DONATION_chk_1` CHECK ((`amount` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `DONATION`
--

LOCK TABLES `DONATION` WRITE;
/*!40000 ALTER TABLE `DONATION` DISABLE KEYS */;
/*!40000 ALTER TABLE `DONATION` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `EMPLOYEE`
--

DROP TABLE IF EXISTS `EMPLOYEE`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `EMPLOYEE` (
  `employee_ID` int NOT NULL AUTO_INCREMENT,
  `manager_ID` int DEFAULT NULL,
  `name` varchar(30) DEFAULT NULL,
  `street_address` varchar(50) DEFAULT NULL,
  `city` varchar(30) DEFAULT NULL,
  `state` varchar(20) DEFAULT NULL,
  `zip_code` varchar(10) DEFAULT NULL,
  `country` varchar(50) DEFAULT NULL,
  `email` varchar(50) DEFAULT NULL,
  `phone_number` varchar(20) DEFAULT NULL,
  `department_ID` int DEFAULT NULL,
  `role` varchar(50) DEFAULT NULL,
  `salary` int DEFAULT NULL,
  `hire_date` date DEFAULT NULL,
  `current` tinyint(1) DEFAULT NULL,
  `hours` int DEFAULT NULL,
  PRIMARY KEY (`employee_ID`),
  KEY `department_ID` (`department_ID`),
  KEY `manager_ID` (`manager_ID`),
  CONSTRAINT `EMPLOYEE_ibfk_1` FOREIGN KEY (`department_ID`) REFERENCES `DEPARTMENT` (`department_ID`),
  CONSTRAINT `EMPLOYEE_ibfk_2` FOREIGN KEY (`manager_ID`) REFERENCES `EMPLOYEE` (`employee_ID`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `EMPLOYEE`
--

LOCK TABLES `EMPLOYEE` WRITE;
/*!40000 ALTER TABLE `EMPLOYEE` DISABLE KEYS */;
/*!40000 ALTER TABLE `EMPLOYEE` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ENCLOSURE`
--

DROP TABLE IF EXISTS `ENCLOSURE`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ENCLOSURE` (
  `enclosure_ID` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) DEFAULT NULL,
  `location` varchar(100) DEFAULT NULL,
  `capacity` int DEFAULT NULL,
  `indoor_outdoor` varchar(20) DEFAULT NULL,
  `size` int DEFAULT NULL,
  `department_ID` int NOT NULL,
  PRIMARY KEY (`enclosure_ID`),
  KEY `department_ID` (`department_ID`),
  CONSTRAINT `ENCLOSURE_ibfk_1` FOREIGN KEY (`department_ID`) REFERENCES `DEPARTMENT` (`department_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ENCLOSURE`
--

LOCK TABLES `ENCLOSURE` WRITE;
/*!40000 ALTER TABLE `ENCLOSURE` DISABLE KEYS */;
/*!40000 ALTER TABLE `ENCLOSURE` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `FEEDING`
--

DROP TABLE IF EXISTS `FEEDING`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `FEEDING` (
  `feeding_ID` int NOT NULL AUTO_INCREMENT,
  `amount` int DEFAULT NULL,
  `animal_ID` int DEFAULT NULL,
  `feeding_time` time DEFAULT NULL,
  `food_ID` int DEFAULT NULL,
  `employee_ID` int DEFAULT NULL,
  PRIMARY KEY (`feeding_ID`),
  KEY `food_ID` (`food_ID`),
  KEY `animal_ID` (`animal_ID`),
  KEY `employee_ID` (`employee_ID`),
  CONSTRAINT `FEEDING_ibfk_1` FOREIGN KEY (`food_ID`) REFERENCES `FEED_ITEM` (`food_ID`),
  CONSTRAINT `FEEDING_ibfk_2` FOREIGN KEY (`animal_ID`) REFERENCES `ANIMAL` (`animal_ID`),
  CONSTRAINT `FEEDING_ibfk_3` FOREIGN KEY (`employee_ID`) REFERENCES `EMPLOYEE` (`employee_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `FEEDING`
--

LOCK TABLES `FEEDING` WRITE;
/*!40000 ALTER TABLE `FEEDING` DISABLE KEYS */;
/*!40000 ALTER TABLE `FEEDING` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `FEED_ITEM`
--

DROP TABLE IF EXISTS `FEED_ITEM`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `FEED_ITEM` (
  `food_ID` int NOT NULL AUTO_INCREMENT,
  `food_name` varchar(100) DEFAULT NULL,
  `food_category` varchar(50) DEFAULT NULL,
  `supplier` varchar(50) DEFAULT NULL,
  `quantity` int DEFAULT NULL,
  PRIMARY KEY (`food_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `FEED_ITEM`
--

LOCK TABLES `FEED_ITEM` WRITE;
/*!40000 ALTER TABLE `FEED_ITEM` DISABLE KEYS */;
/*!40000 ALTER TABLE `FEED_ITEM` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `FOOD_STALL`
--

DROP TABLE IF EXISTS `FOOD_STALL`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `FOOD_STALL` (
  `stall_ID` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) DEFAULT NULL,
  `location` varchar(100) DEFAULT NULL,
  `opening_time` time DEFAULT NULL,
  `closing_time` time DEFAULT NULL,
  `department_ID` int NOT NULL,
  PRIMARY KEY (`stall_ID`),
  KEY `department_ID` (`department_ID`),
  CONSTRAINT `FOOD_STALL_ibfk_1` FOREIGN KEY (`department_ID`) REFERENCES `DEPARTMENT` (`department_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `FOOD_STALL`
--

LOCK TABLES `FOOD_STALL` WRITE;
/*!40000 ALTER TABLE `FOOD_STALL` DISABLE KEYS */;
/*!40000 ALTER TABLE `FOOD_STALL` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `GIFT_SHOP`
--

DROP TABLE IF EXISTS `GIFT_SHOP`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `GIFT_SHOP` (
  `shop_ID` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) DEFAULT NULL,
  `location` varchar(100) DEFAULT NULL,
  `department_ID` int NOT NULL,
  PRIMARY KEY (`shop_ID`),
  KEY `department_ID` (`department_ID`),
  CONSTRAINT `GIFT_SHOP_ibfk_1` FOREIGN KEY (`department_ID`) REFERENCES `DEPARTMENT` (`department_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `GIFT_SHOP`
--

LOCK TABLES `GIFT_SHOP` WRITE;
/*!40000 ALTER TABLE `GIFT_SHOP` DISABLE KEYS */;
/*!40000 ALTER TABLE `GIFT_SHOP` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `MEDICAL_RECORD`
--

DROP TABLE IF EXISTS `MEDICAL_RECORD`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `MEDICAL_RECORD` (
  `record_ID` int NOT NULL AUTO_INCREMENT,
  `animal_ID` int DEFAULT NULL,
  `date` date DEFAULT NULL,
  `diagnosis` varchar(255) DEFAULT NULL,
  `treatment` varchar(255) DEFAULT NULL,
  `notes` varchar(255) DEFAULT NULL,
  `vet_ID` int DEFAULT NULL,
  `follow_up` date DEFAULT NULL,
  PRIMARY KEY (`record_ID`),
  KEY `animal_ID` (`animal_ID`),
  KEY `vet_ID` (`vet_ID`),
  CONSTRAINT `MEDICAL_RECORD_ibfk_1` FOREIGN KEY (`animal_ID`) REFERENCES `ANIMAL` (`animal_ID`),
  CONSTRAINT `MEDICAL_RECORD_ibfk_2` FOREIGN KEY (`vet_ID`) REFERENCES `EMPLOYEE` (`employee_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `MEDICAL_RECORD`
--

LOCK TABLES `MEDICAL_RECORD` WRITE;
/*!40000 ALTER TABLE `MEDICAL_RECORD` DISABLE KEYS */;
/*!40000 ALTER TABLE `MEDICAL_RECORD` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `MEMBERSHIP`
--

DROP TABLE IF EXISTS `MEMBERSHIP`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `MEMBERSHIP` (
  `membership_ID` int NOT NULL AUTO_INCREMENT,
  `visitor_ID` int DEFAULT NULL,
  `membership_type` varchar(30) DEFAULT NULL,
  `start_date` datetime NOT NULL,
  `expiration_date` datetime NOT NULL,
  PRIMARY KEY (`membership_ID`),
  KEY `visitor_ID` (`visitor_ID`),
  CONSTRAINT `MEMBERSHIP_ibfk_1` FOREIGN KEY (`visitor_ID`) REFERENCES `VISITOR` (`visitor_ID`) ON DELETE CASCADE,
  CONSTRAINT `MEMBERSHIP_chk_1` CHECK ((`expiration_date` > `start_date`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `MEMBERSHIP`
--

LOCK TABLES `MEMBERSHIP` WRITE;
/*!40000 ALTER TABLE `MEMBERSHIP` DISABLE KEYS */;
/*!40000 ALTER TABLE `MEMBERSHIP` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `MENU_ITEM`
--

DROP TABLE IF EXISTS `MENU_ITEM`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `MENU_ITEM` (
  `item_ID` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) DEFAULT NULL,
  `price` decimal(8,2) DEFAULT NULL,
  `category` varchar(50) DEFAULT NULL,
  `stall_ID` int NOT NULL,
  PRIMARY KEY (`item_ID`),
  KEY `stall_ID` (`stall_ID`),
  CONSTRAINT `MENU_ITEM_ibfk_1` FOREIGN KEY (`stall_ID`) REFERENCES `FOOD_STALL` (`stall_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `MENU_ITEM`
--

LOCK TABLES `MENU_ITEM` WRITE;
/*!40000 ALTER TABLE `MENU_ITEM` DISABLE KEYS */;
/*!40000 ALTER TABLE `MENU_ITEM` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `PARKING_LOT`
--

DROP TABLE IF EXISTS `PARKING_LOT`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `PARKING_LOT` (
  `lot_ID` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) DEFAULT NULL,
  `location` varchar(100) DEFAULT NULL,
  `capacity` int DEFAULT NULL,
  `parking_rate` decimal(8,2) DEFAULT NULL,
  `department_ID` int NOT NULL,
  PRIMARY KEY (`lot_ID`),
  KEY `department_ID` (`department_ID`),
  CONSTRAINT `PARKING_LOT_ibfk_1` FOREIGN KEY (`department_ID`) REFERENCES `DEPARTMENT` (`department_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `PARKING_LOT`
--

LOCK TABLES `PARKING_LOT` WRITE;
/*!40000 ALTER TABLE `PARKING_LOT` DISABLE KEYS */;
/*!40000 ALTER TABLE `PARKING_LOT` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `PARKING_SESSION`
--

DROP TABLE IF EXISTS `PARKING_SESSION`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `PARKING_SESSION` (
  `session_ID` int NOT NULL AUTO_INCREMENT,
  `lot_ID` int NOT NULL,
  `license_plate` varchar(20) DEFAULT NULL,
  `entry_time` datetime DEFAULT NULL,
  `exit_time` datetime DEFAULT NULL,
  PRIMARY KEY (`session_ID`),
  KEY `lot_ID` (`lot_ID`),
  CONSTRAINT `PARKING_SESSION_ibfk_1` FOREIGN KEY (`lot_ID`) REFERENCES `PARKING_LOT` (`lot_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `PARKING_SESSION`
--

LOCK TABLES `PARKING_SESSION` WRITE;
/*!40000 ALTER TABLE `PARKING_SESSION` DISABLE KEYS */;
/*!40000 ALTER TABLE `PARKING_SESSION` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `PRODUCT`
--

DROP TABLE IF EXISTS `PRODUCT`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `PRODUCT` (
  `product_ID` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) DEFAULT NULL,
  `category` varchar(50) DEFAULT NULL,
  `price` decimal(8,2) DEFAULT NULL,
  `quantity_in_stock` int DEFAULT NULL,
  `color` varchar(50) DEFAULT NULL,
  `design` varchar(100) DEFAULT NULL,
  `shop_ID` int NOT NULL,
  PRIMARY KEY (`product_ID`),
  KEY `shop_ID` (`shop_ID`),
  CONSTRAINT `PRODUCT_ibfk_1` FOREIGN KEY (`shop_ID`) REFERENCES `GIFT_SHOP` (`shop_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `PRODUCT`
--

LOCK TABLES `PRODUCT` WRITE;
/*!40000 ALTER TABLE `PRODUCT` DISABLE KEYS */;
/*!40000 ALTER TABLE `PRODUCT` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `SPECIES`
--

DROP TABLE IF EXISTS `SPECIES`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `SPECIES` (
  `species_ID` int NOT NULL AUTO_INCREMENT,
  `common_name` varchar(100) DEFAULT NULL,
  `scientific_name` varchar(100) DEFAULT NULL,
  `endangered_status` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`species_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `SPECIES`
--

LOCK TABLES `SPECIES` WRITE;
/*!40000 ALTER TABLE `SPECIES` DISABLE KEYS */;
/*!40000 ALTER TABLE `SPECIES` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `STAFFED_AT`
--

DROP TABLE IF EXISTS `STAFFED_AT`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `STAFFED_AT` (
  `employee_ID` int NOT NULL,
  `attr_ID` int NOT NULL,
  PRIMARY KEY (`employee_ID`,`attr_ID`),
  KEY `attr_ID` (`attr_ID`),
  CONSTRAINT `STAFFED_AT_ibfk_1` FOREIGN KEY (`employee_ID`) REFERENCES `EMPLOYEE` (`employee_ID`),
  CONSTRAINT `STAFFED_AT_ibfk_2` FOREIGN KEY (`attr_ID`) REFERENCES `ATTRACTION` (`attr_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `STAFFED_AT`
--

LOCK TABLES `STAFFED_AT` WRITE;
/*!40000 ALTER TABLE `STAFFED_AT` DISABLE KEYS */;
/*!40000 ALTER TABLE `STAFFED_AT` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `TICKET`
--

DROP TABLE IF EXISTS `TICKET`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `TICKET` (
  `ticket_ID` int NOT NULL AUTO_INCREMENT,
  `visitor_ID` int DEFAULT NULL,
  `ticket_type` varchar(30) DEFAULT NULL,
  `price` int DEFAULT NULL,
  `purchase_date` date DEFAULT NULL,
  `visit_date` date DEFAULT NULL,
  PRIMARY KEY (`ticket_ID`),
  KEY `visitor_ID` (`visitor_ID`),
  CONSTRAINT `TICKET_ibfk_1` FOREIGN KEY (`visitor_ID`) REFERENCES `VISITOR` (`visitor_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `TICKET`
--

LOCK TABLES `TICKET` WRITE;
/*!40000 ALTER TABLE `TICKET` DISABLE KEYS */;
/*!40000 ALTER TABLE `TICKET` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `TRANSACTION_ITEM`
--

DROP TABLE IF EXISTS `TRANSACTION_ITEM`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `TRANSACTION_ITEM` (
  `transaction_item_ID` int NOT NULL AUTO_INCREMENT,
  `transaction_ID` int DEFAULT NULL,
  `item_type` varchar(20) NOT NULL,
  `item_ID` int NOT NULL,
  `quantity` int NOT NULL DEFAULT '1',
  `price` decimal(10,2) NOT NULL,
  PRIMARY KEY (`transaction_item_ID`),
  KEY `transaction_ID` (`transaction_ID`),
  CONSTRAINT `TRANSACTION_ITEM_ibfk_1` FOREIGN KEY (`transaction_ID`) REFERENCES `CUST_TRANSACTION` (`transaction_ID`) ON DELETE CASCADE,
  CONSTRAINT `TRANSACTION_ITEM_chk_1` CHECK ((`item_type` in (_utf8mb4'food',_utf8mb4'product',_utf8mb4'ticket',_utf8mb4'parking',_utf8mb4'donation'))),
  CONSTRAINT `TRANSACTION_ITEM_chk_2` CHECK ((`quantity` > 0)),
  CONSTRAINT `TRANSACTION_ITEM_chk_3` CHECK ((`price` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `TRANSACTION_ITEM`
--

LOCK TABLES `TRANSACTION_ITEM` WRITE;
/*!40000 ALTER TABLE `TRANSACTION_ITEM` DISABLE KEYS */;
/*!40000 ALTER TABLE `TRANSACTION_ITEM` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `VISITOR`
--

DROP TABLE IF EXISTS `VISITOR`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `VISITOR` (
  `visitor_ID` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) DEFAULT NULL,
  `age` int DEFAULT NULL,
  `date_of_birth` date DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `membership` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`visitor_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `VISITOR`
--

LOCK TABLES `VISITOR` WRITE;
/*!40000 ALTER TABLE `VISITOR` DISABLE KEYS */;
/*!40000 ALTER TABLE `VISITOR` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `donor`
--

DROP TABLE IF EXISTS `donor`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `donor` (
  `donor_ID` int NOT NULL AUTO_INCREMENT,
  `donor_name` varchar(100) NOT NULL,
  `donor_email` varchar(100) NOT NULL,
  `donor_phone` varchar(20) NOT NULL,
  PRIMARY KEY (`donor_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `donor`
--

LOCK TABLES `donor` WRITE;
/*!40000 ALTER TABLE `donor` DISABLE KEYS */;
/*!40000 ALTER TABLE `donor` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-01 21:51:02
