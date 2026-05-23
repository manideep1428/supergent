"use client"

import { useState } from "react"
import { Separator } from "@workspace/ui/components/separator"
import { Button } from "@workspace/ui/components/button"
import { Bell, Mail, Smartphone, Globe, Info } from "lucide-react"

export function NotificationsForm() {
  const [prefs, setPrefs] = useState({
    emailUpdates: true,
    emailSecurity: true,
    agentAlerts: false,
    systemBanner: true,
    pushWeekly: false,
  })

  const toggle = (key: keyof typeof prefs) => {
    setPrefs(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const handleSave = () => {
    // Mock save preferences
    alert("Notification preferences updated successfully!")
  }

  return (
    <div className="space-y-8">
      {/* Email Preferences */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <h3 className="font-semibold text-base flex items-center gap-2">
            <Mail size={16} /> Email Notifications
          </h3>
          <p className="text-muted-foreground text-xs mt-1">
            Choose what alerts and activities you want sent directly to your email address.
          </p>
        </div>
        <div className="md:col-span-2 border rounded-xl p-6 bg-card space-y-6 shadow-sm">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <h5 className="font-medium text-sm">Product Updates & Features</h5>
                <p className="text-muted-foreground text-xs">Stay up to date with new features, updates, and templates.</p>
              </div>
              <button 
                onClick={() => toggle("emailUpdates")}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${prefs.emailUpdates ? 'bg-primary' : 'bg-muted'}`}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out ${prefs.emailUpdates ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h5 className="font-medium text-sm">Security & System Alerts</h5>
                <p className="text-muted-foreground text-xs">Important emails regarding account logins, database changes, and API settings.</p>
              </div>
              <button 
                onClick={() => toggle("emailSecurity")}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${prefs.emailSecurity ? 'bg-primary' : 'bg-muted'}`}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out ${prefs.emailSecurity ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {/* AI Agent Alerts */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <h3 className="font-semibold text-base flex items-center gap-2">
            <Globe size={16} /> Workflow Activity
          </h3>
          <p className="text-muted-foreground text-xs mt-1">
            Realtime notifications on active background executions and Instagram postings.
          </p>
        </div>
        <div className="md:col-span-2 border rounded-xl p-6 bg-card space-y-6 shadow-sm">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <h5 className="font-medium text-sm">AI Agent Complete Actions</h5>
                <p className="text-muted-foreground text-xs">Notify when an Instagram post or automation flow completes execution.</p>
              </div>
              <button 
                onClick={() => toggle("agentAlerts")}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${prefs.agentAlerts ? 'bg-primary' : 'bg-muted'}`}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out ${prefs.agentAlerts ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h5 className="font-medium text-sm">Workspace Banners</h5>
                <p className="text-muted-foreground text-xs">Show banner notifications inside the main application dashboard.</p>
              </div>
              <button 
                onClick={() => toggle("systemBanner")}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${prefs.systemBanner ? 'bg-primary' : 'bg-muted'}`}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out ${prefs.systemBanner ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {/* Push Notifications */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <h3 className="font-semibold text-base flex items-center gap-2">
            <Smartphone size={16} /> Mobile Push Notifications
          </h3>
          <p className="text-muted-foreground text-xs mt-1">
            Configure how alerts are pushed directly to your synced mobile devices.
          </p>
        </div>
        <div className="md:col-span-2 border rounded-xl p-6 bg-card space-y-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h5 className="font-medium text-sm">Weekly Activity Reports</h5>
              <p className="text-muted-foreground text-xs">Push summarized weekly execution stats to your linked phone.</p>
            </div>
            <button 
              onClick={() => toggle("pushWeekly")}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${prefs.pushWeekly ? 'bg-primary' : 'bg-muted'}`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out ${prefs.pushWeekly ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
        </div>
      </div>

      <Separator />

      <div className="flex justify-end gap-3">
        <Button variant="outline">Reset</Button>
        <Button onClick={handleSave}>Save Preferences</Button>
      </div>
    </div>
  )
}
