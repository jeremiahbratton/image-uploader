FROM node:24-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application files
COPY . .

# Create uploads directory
RUN mkdir -p uploads public/dist

# Build client bundle
RUN npm run build

# Expose port
EXPOSE 3000

# Start server
CMD ["npm", "start"]

