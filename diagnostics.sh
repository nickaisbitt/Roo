#!/bin/bash

# Roo Podcast Automation - Diagnostic Script
# This script helps diagnose common issues with the automation

set -e

echo "🔍 Roo Podcast Automation - System Diagnostics"
echo "=============================================="
echo

# Check if development tools are available
echo "🛠️  Development Tools Status"
echo "----------------------------"

if [ -f "roo-dev.js" ]; then
    echo -e "✅ ${GREEN}roo-dev.js${NC} - Development CLI available"
    echo "   Run: node roo-dev.js help"
    echo "   Features: Project initialization, Unicode file search, cross-platform support"
else
    echo -e "❌ ${RED}roo-dev.js${NC} - Development CLI not found"
fi

if [ -f "src/dev-tools.js" ]; then
    echo -e "✅ ${GREEN}src/dev-tools.js${NC} - Development utilities available"
else
    echo -e "❌ ${RED}src/dev-tools.js${NC} - Development utilities not found"
fi

if [ -f ".roo-context.json" ]; then
    echo -e "✅ ${GREEN}.roo-context.json${NC} - Project context available (run: node roo-dev.js init to update)"
else
    echo -e "ℹ️  ${YELLOW}.roo-context.json${NC} - Project context not generated (run: node roo-dev.js init)"
fi

echo

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check environment variable
check_env_var() {
    local var_name=$1
    local is_required=$2
    local description=$3
    
    if [ -z "${!var_name}" ]; then
        if [ "$is_required" = "true" ]; then
            echo -e "❌ ${RED}$var_name${NC} - MISSING (Required) - $description"
            return 1
        else
            echo -e "⚠️  ${YELLOW}$var_name${NC} - Not set (Optional) - $description"
            return 0
        fi
    else
        local value="${!var_name}"
        local display_value
        
        # Hide sensitive values
        if [[ "$var_name" =~ (SECRET|TOKEN|KEY) ]]; then
            if [ ${#value} -gt 8 ]; then
                display_value="${value:0:4}...${value: -4}"
            else
                display_value="***"
            fi
        else
            display_value="$value"
        fi
        
        echo -e "✅ ${GREEN}$var_name${NC} - Set ($display_value) - $description"
        return 0
    fi
}

# Check required tools
echo "🛠️  Checking Required Tools"
echo "----------------------------"

tools_ok=true
for tool in curl node npm jq ffmpeg; do
    if command_exists "$tool"; then
        version=$($tool --version 2>&1 | head -n1 | cut -d' ' -f1-2)
        echo -e "✅ ${GREEN}$tool${NC} - Available ($version)"
    else
        echo -e "❌ ${RED}$tool${NC} - Not found"
        tools_ok=false
    fi
done

if [ "$tools_ok" = false ]; then
    echo
    echo -e "${YELLOW}Install missing tools:${NC}"
    echo "  • curl: Usually pre-installed on most systems"
    echo "  • node/npm: https://nodejs.org/"
    echo "  • jq: https://stedolan.github.io/jq/"
    echo "  • ffmpeg: https://ffmpeg.org/"
fi

echo

# Check Node.js project
echo "📦 Checking Node.js Project"
echo "----------------------------"

if [ -f "package.json" ]; then
    echo -e "✅ ${GREEN}package.json${NC} - Found"
    
    if [ -d "node_modules" ]; then
        echo -e "✅ ${GREEN}node_modules${NC} - Found"
    else
        echo -e "⚠️  ${YELLOW}node_modules${NC} - Not found. Run: npm install"
    fi
    
    # Check key dependencies
    for dep in axios dotenv googleapis node-fetch form-data dayjs; do
        if npm list "$dep" >/dev/null 2>&1; then
            echo -e "✅ ${GREEN}$dep${NC} - Installed"
        else
            echo -e "❌ ${RED}$dep${NC} - Missing dependency"
        fi
    done
else
    echo -e "❌ ${RED}package.json${NC} - Not found. Are you in the right directory?"
fi

echo

# Check environment variables
echo "🔧 Checking Environment Variables"
echo "----------------------------------"

env_errors=0

# Required variables
check_env_var "GOOGLE_SHEETS_SPREADSHEET_ID" "true" "Google Sheets document ID" || ((env_errors++))
check_env_var "GOOGLE_SHEETS_TAB_NAME" "true" "Google Sheets tab name" || ((env_errors++))
check_env_var "GOOGLE_SERVICE_ACCOUNT_JSON" "true" "Google service account credentials" || ((env_errors++))
check_env_var "OPENAI_API_KEY" "true" "OpenAI API key for content generation" || ((env_errors++))
check_env_var "SPREAKER_CLIENT_ID" "true" "Spreaker OAuth client ID" || ((env_errors++))
check_env_var "SPREAKER_CLIENT_SECRET" "true" "Spreaker OAuth client secret" || ((env_errors++))
check_env_var "SPREAKER_REFRESH_TOKEN" "true" "Spreaker OAuth refresh token" || ((env_errors++))
check_env_var "SPREAKER_SHOW_ID" "true" "Spreaker show ID for uploads" || ((env_errors++))

# Optional variables
check_env_var "OPENAI_TEXT_MODEL" "false" "OpenAI text model (default: gpt-4o)"
check_env_var "MAX_EPISODES_PER_RUN" "false" "Max episodes per run (default: 2)"
check_env_var "EPISODE_TIMEZONE" "false" "Episode timezone (default: UTC)"
check_env_var "SPREAKER_PUBLISH_TIME_UTC" "false" "Default publish time (default: 08:00:00)"
check_env_var "DRY_RUN" "false" "Dry run mode (default: false)"

# Railway auto-update variables
echo
echo "Railway Auto-Update Variables:"
check_env_var "RAILWAY_API_TOKEN" "false" "Railway API token for env updates"
check_env_var "RAILWAY_PROJECT_ID" "false" "Railway project ID"
check_env_var "RAILWAY_ENVIRONMENT_ID" "false" "Railway environment ID (default: production)"

echo

# API connectivity tests
echo "🌐 Testing API Connectivity"
echo "----------------------------"

# Test OpenAI API
if [ -n "$OPENAI_API_KEY" ]; then
    echo "Testing OpenAI API..."
    if curl -s -H "Authorization: Bearer $OPENAI_API_KEY" \
            https://api.openai.com/v1/models >/dev/null 2>&1; then
        echo -e "✅ ${GREEN}OpenAI API${NC} - Connection successful"
    else
        echo -e "❌ ${RED}OpenAI API${NC} - Connection failed or invalid key"
        ((env_errors++))
    fi
else
    echo -e "⏭️  ${YELLOW}OpenAI API${NC} - Skipped (no API key set)"
fi

# Test Spreaker API (token refresh)
if [ -n "$SPREAKER_CLIENT_ID" ] && [ -n "$SPREAKER_CLIENT_SECRET" ] && [ -n "$SPREAKER_REFRESH_TOKEN" ]; then
    echo "Testing Spreaker API credentials first..."
    
    # Test credentials with invalid refresh token to validate app credentials
    credential_response=$(curl -s -w "%{http_code}" -o /tmp/spreaker_credential_test.json \
        -X POST https://api.spreaker.com/oauth2/token \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "grant_type=refresh_token" \
        -d "client_id=$SPREAKER_CLIENT_ID" \
        -d "client_secret=$SPREAKER_CLIENT_SECRET" \
        -d "refresh_token=invalid_test_token_for_credential_validation")
    
    if [ "$credential_response" = "400" ]; then
        # Check if it's the expected invalid_grant error (credentials valid)
        if command_exists jq && [ -f /tmp/spreaker_credential_test.json ]; then
            error_type=$(jq -r '.error // empty' /tmp/spreaker_credential_test.json 2>/dev/null)
            if [ "$error_type" = "invalid_grant" ]; then
                echo -e "✅ ${GREEN}Spreaker Credentials${NC} - Valid (got expected invalid_grant error)"
            elif [ "$error_type" = "invalid_client" ]; then
                echo -e "❌ ${RED}Spreaker Credentials${NC} - Invalid client credentials"
                ((env_errors++))
            else
                echo -e "⚠️  ${YELLOW}Spreaker Credentials${NC} - Unexpected error: $error_type"
            fi
        else
            echo -e "⚠️  ${YELLOW}Spreaker Credentials${NC} - Could not parse response (jq not available)"
        fi
    elif [ "$credential_response" = "401" ]; then
        echo -e "❌ ${RED}Spreaker Credentials${NC} - Invalid credentials (401 Unauthorized)"
        ((env_errors++))
    else
        echo -e "⚠️  ${YELLOW}Spreaker Credentials${NC} - Unexpected HTTP response: $credential_response"
    fi
    
    rm -f /tmp/spreaker_credential_test.json
    
    echo "Testing Spreaker API (token refresh)..."
    
    response=$(curl -s -w "%{http_code}" -o /tmp/spreaker_test.json \
        -X POST https://api.spreaker.com/oauth2/token \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "grant_type=refresh_token" \
        -d "client_id=$SPREAKER_CLIENT_ID" \
        -d "client_secret=$SPREAKER_CLIENT_SECRET" \
        -d "refresh_token=$SPREAKER_REFRESH_TOKEN")
    
    if [ "$response" = "200" ]; then
        echo -e "✅ ${GREEN}Spreaker API${NC} - Token refresh successful"
        
        # Check if new refresh token was provided
        if command_exists jq && [ -f /tmp/spreaker_test.json ]; then
            new_token=$(jq -r '.refresh_token // empty' /tmp/spreaker_test.json 2>/dev/null)
            if [ -n "$new_token" ] && [ "$new_token" != "$SPREAKER_REFRESH_TOKEN" ]; then
                echo -e "⚠️  ${YELLOW}New refresh token available${NC} - Update SPREAKER_REFRESH_TOKEN"
                echo "   New token: ${new_token:0:10}...${new_token: -10}"
            fi
        fi
    else
        echo -e "❌ ${RED}Spreaker API${NC} - Token refresh failed (HTTP $response)"
        if [ -f /tmp/spreaker_test.json ]; then
            error_msg=$(cat /tmp/spreaker_test.json 2>/dev/null | head -n5)
            echo "   Error: $error_msg"
            
            # Additional guidance based on error
            if command_exists jq; then
                error_type=$(echo "$error_msg" | jq -r '.error // empty' 2>/dev/null)
                if [ "$error_type" = "invalid_grant" ]; then
                    echo "   💡 This suggests the refresh token has expired - generate a new one"
                elif [ "$error_type" = "invalid_client" ]; then
                    echo "   💡 This suggests invalid credentials - check CLIENT_ID and CLIENT_SECRET"  
                fi
            fi
        fi
        ((env_errors++))
    fi
    
    rm -f /tmp/spreaker_test.json
else
    echo -e "⏭️  ${YELLOW}Spreaker API${NC} - Skipped (missing credentials)"
fi

echo

# File system checks
echo "📁 Checking File System"
echo "------------------------"

# Check tmp directory
if [ -w "/tmp" ]; then
    echo -e "✅ ${GREEN}/tmp directory${NC} - Writable"
else
    echo -e "❌ ${RED}/tmp directory${NC} - Not writable"
    ((env_errors++))
fi

# Check current directory permissions  
if [ -w "." ]; then
    echo -e "✅ ${GREEN}Current directory${NC} - Writable"
else
    echo -e "❌ ${RED}Current directory${NC} - Not writable"
fi

# Check for key files
for file in "src/index.js" "oauth-server.js" "package.json"; do
    if [ -f "$file" ]; then
        echo -e "✅ ${GREEN}$file${NC} - Found"
    else
        echo -e "❌ ${RED}$file${NC} - Missing"
    fi
done

echo

# Summary
echo "📋 Diagnostic Summary" 
echo "--------------------"

if [ $env_errors -eq 0 ]; then
    echo -e "✅ ${GREEN}All checks passed!${NC} The system appears to be configured correctly."
    echo
    echo "Next steps:"
    echo "  • Run: npm start (for production)"
    echo "  • Run: npm run dev (for development with file watching)"
    echo "  • Check logs for any runtime errors"
else
    echo -e "❌ ${RED}Found $env_errors issue(s)${NC} that need to be resolved."
    echo
    echo "Action required:"
    echo "  • Fix the issues marked with ❌ above"
    echo "  • Refer to MANUAL_WORKFLOW.md for detailed setup instructions"
    echo "  • Check environment variable configuration"
fi

echo
echo "For detailed troubleshooting, see:"
echo "  • MANUAL_WORKFLOW.md"
echo "  • QUICK_REFERENCE.md" 
echo "  • EXAMPLE_WALKTHROUGH.md"