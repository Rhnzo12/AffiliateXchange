import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { format } from "date-fns";
import { TopNavBar } from "../components/TopNavBar";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  linkUrl: string | null;
  metadata?: any;
  isRead: boolean;
  createdAt: string;
}

async function fetchNotificationById(id?: string): Promise<Notification | null> {
  if (!id) return null;
  const res = await fetch(`/api/notifications/${encodeURIComponent(id)}`, { credentials: "include" });
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error("Failed to fetch notification");
  }
  return res.json();
}

async function markAsRead(id: string) {
  await fetch(`/api/notifications/${id}/read`, { method: "POST", credentials: "include" });
}

export default function NotificationDetail() {
  const [, params] = useRoute("/notifications/:id");
  const id = params?.id as string | undefined;
  const queryClient = useQueryClient();
  const { data: notification, isLoading } = useQuery<Notification | null>({
    queryKey: ["/api/notifications", id],
    queryFn: () => fetchNotificationById(id),
    enabled: !!id,
  });

  const markAsReadMutation = useMutation({
    mutationFn: () => markAsRead(id || ""),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications", id] });
    },
  });

  useEffect(() => {
    if (id && notification && !notification.isRead) {
      markAsReadMutation.mutate();
    }
  }, [id, notification]);

  if (isLoading) return <div className="p-8 text-center">Loading...</div>;

  if (!notification) {
    return (
      <div className="text-center p-8">
        <p className="text-muted-foreground">Notification not found</p>
        <div className="mt-4">
          <Link href="/notifications"><Button>Back to notifications</Button></Link>
        </div>
      </div>
    );
  }
  const renderBody = (n: Notification) => {
    const meta = n.metadata || {};

    switch (n.type) {
      case "payment_received":
      case "payment": {
        const amount = meta.amount || meta.total || (n.message.match(/\$\d+[\d,.]*/)?.[0]) || null;
        return (
          <div className="space-y-4">
            <p className="text-lg">{n.message}</p>
            {amount && <div className="text-2xl font-bold">{amount}</div>}
            {n.linkUrl && (
              <a href={n.linkUrl} className="text-primary hover:underline">View payment details</a>
            )}
          </div>
        );
      }

      case "payment_failed_insufficient_funds": {
        const amount = meta.amount || (n.message.match(/\$\d+[\d,.]*/)?.[0]) || null;
        return (
          <div className="space-y-4">
            <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
              <h3 className="font-semibold text-orange-900 dark:text-orange-100 mb-2">
                Payment Processing Failed
              </h3>
              <p className="text-orange-800 dark:text-orange-200">{n.message}</p>
              {amount && (
                <div className="mt-3 text-lg font-bold text-orange-900 dark:text-orange-100">
                  Payment Amount: {amount}
                </div>
              )}
            </div>
            <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <h4 className="font-semibold text-green-900 dark:text-green-100 mb-2">
                What to do next:
              </h4>
              <ol className="list-decimal list-inside space-y-1 text-green-800 dark:text-green-200">
                <li>Add funds to your PayPal business account</li>
                <li>Wait a few moments for the funds to become available</li>
                <li>Contact the admin to retry the payment</li>
              </ol>
            </div>
            {n.linkUrl && (
              <Link href={n.linkUrl}>
                <Button className="w-full">View Payment Details</Button>
              </Link>
            )}
          </div>
        );
      }

      case "new_message":
      case "message": {
        const convId = meta.conversationId || meta.conversation_id;
        return (
          <div className="space-y-4">
            <p>{n.message}</p>
            {convId && (
              <Link href={`/messages?conversation=${convId}`}><Button>Open conversation</Button></Link>
            )}
            {n.linkUrl && !convId && (
              <a href={n.linkUrl} className="text-primary hover:underline">Open message</a>
            )}
          </div>
        );
      }

      case "application_status_change":
      case "application": {
        const appId = meta.applicationId || meta.application_id;
        return (
          <div className="space-y-4">
            <p>{n.message}</p>
            {appId && (
              <Link href={`/applications/${appId}`}><Button>View application</Button></Link>
            )}
            {n.linkUrl && !appId && <a href={n.linkUrl} className="text-primary hover:underline">Open</a>}
          </div>
        );
      }

      case "offer_approved":
      case "offer_rejected":
      case "offer": {
        const offerId = meta.offerId || meta.offer_id;
        return (
          <div className="space-y-4">
            <p>{n.message}</p>
            {offerId && (
              <Link href={`/offers/${offerId}`}><Button>View offer</Button></Link>
            )}
            {n.linkUrl && !offerId && <a href={n.linkUrl} className="text-primary hover:underline">Open</a>}
          </div>
        );
      }

      case "review_received":
      case "review": {
        return (
          <div className="space-y-4">
            <p>{n.message}</p>
            {n.linkUrl && <a href={n.linkUrl} className="text-primary hover:underline">View review</a>}
          </div>
        );
      }

      case "system_announcement":
      case "announcement":
      default:
        return <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: n.message }} />;
    }
  };

  return (
    <div>
      <TopNavBar />
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{notification.title}</h1>
        <div className="text-sm text-muted-foreground">{format(new Date(notification.createdAt), 'PPP p')}</div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{notification.title}</CardTitle>
        </CardHeader>
        <CardContent>
          {renderBody(notification)}
        </CardContent>
      </Card>

      <div className="mt-6">
        <Link href="/notifications"><Button variant="ghost">Back</Button></Link>
      </div>
    </div>
  );
}
