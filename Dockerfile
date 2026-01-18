FROM ruby:3.1-slim

# Install system dependencies
RUN apt-get update -qq && apt-get install -y \
    build-essential \
    git \
    curl \
    patch \
    libssl-dev \
    zlib1g-dev \
    tzdata \
    && rm -rf /var/lib/apt/lists/*

# Set the timezone
ENV TZ=Asia/Kolkata

# Set up working directory
WORKDIR /srv/jekyll

# Copy dependency files
COPY Gemfile* ./

# Install Ruby dependencies
RUN bundle install

# Expose the Jekyll port
EXPOSE 2255

# Run Jekyll
CMD ["bundle", "exec", "jekyll", "serve", "--host", "0.0.0.0", "--port", "2255", "--force_polling"]
