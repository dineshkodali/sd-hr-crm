# Troubleshooting Database Connection

## Issue: `EHOSTUNREACH`
The application is failing to connect to the database at `18.130.77.174:5432`.
The logs show: `connect EHOSTUNREACH 18.130.77.174:5432`.

## Cause
This error indicates a network unreachable status. The most likely cause is that your **public IP address** is not whitelisted in the AWS Security Group for the database instance.

## Solution
1.  **Find your IP**: Google "what is my ip".
2.  **Update Security Group**: Go to your AWS Console -> EC2 -> Security Groups. Find the group attached to the instance `18.130.77.174`.
3.  **Add Inbound Rule**: Allow TCP traffic on port `5432` from your current IP address.
4.  **Verify**: creating this file should be enough notification. Refresh the app.
