# Phantasmagoria Alumni Network (Coursework 1)

This project contains the main database the alumni website and the administrative developer portal. It acts as the absolute core of the entire software system handling all user accounts profiles and the daily auction system. 

## 1. What does the system actually do

The network revolves around a blind bidding auction. University alumni log into the portal and create a personal profile listing their degrees and jobs. Every single day alumni can place a silent financial bid. At exactly midnight the system automatically calculates the highest bids and selects a winner. The winner becomes the "Alumni of the Day" and their profile is securely extracted and pushed to an external Augmented Reality application.

To keep things fair the system forces a strict limit. A single alumnus can only win the auction three times in a single calendar month. 

## 2. Step by Step Setup Guide

If you are running this for the very first time you need to follow these exact steps to load the system. 

First you need to turn your database on. Open XAMPP or your preferred local server and start MySQL. Open your database manager like phpMyAdmin and create a blank database named `phantasmagoria`. Once it is created locate the `database.sql` file inside this folder and import it directly into your database. This will generate all the strict 3NF tables required to run the code. 

Second you need to configure your environment variables. Find the file named `.env.example` and change its name to `.env`. Open it in any text editor. You need to put your database password in the `DB_PASS` field. Because the system sends real verification emails you must also put a real Gmail address in the `EMAIL_USER` field and generate a Google App Password to place inside the `EMAIL_PASS` field. 

Finally open your terminal in this directory and type `npm install` to download the packages. When that finishes type `npm start` and the server will launch successfully on port 3000. 

## 3. How to use the Alumni Portal

Open your web browser and go to `localhost:3000`. You will see the main website. Click the register button and create a brand new account. The system will hold your account completely hostage until you verify your email address. Open your email inbox click the secure one hour verification link and your account is officially unlocked. 

Once you log in you can navigate to the profile section and start filling out your degrees and work history. You can then navigate to the bidding screen and insert a financial amount to attempt to win the alumni of the day slot for an upcoming date.

## 4. How to create an Administrator Account

The system is designed so that administrators go through the exact same registration flow as normal users to prevent automated attacks on special admin paths. 

To become a developer you simply register a normal account on the website and verify your email. Then you open your database manager software and look at the `users` table. Find your specific account row and change the written value in the `role` column from `alumni` directly to `developer`. The absolute next time you click login on the website the server will recognize your new authority and instantly route you into the private Developer Portal.

## 5. Overriding Bidding Constraints (The 4th Win)

As mentioned earlier the system automatically blocks users from winning the auction more than three times a month. However there is a specific exemption built into the business logic. 

If a user attends a university event a developer can log into the Developer Portal search for that specific user and explicitly grant them a participation badge. This flips a special data flag called `has_event_participation`. When the midnight algorithm runs again it will detect that flag and permit that specific user to win a fourth time.
